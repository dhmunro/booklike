/* Make a web page resemble a simple book showing two pages at once.
   The pages can be either side by side for landscape layouts, or one
   above the other for portrait or flipbook layouts.
 */

import ThemeColors from "./ctheme.js"
const theme = new ThemeColors()
/* // To change color theme:
 * const html = document.documentElement;
 * theme.change("selenized dark");
 *   // or "solarized light", "selenized white", etc.
 */

class PageManager {
  constructor() {
    this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.landscape = getComputedStyle(
      document.body).getPropertyValue("--orientation") == "landscape";
    this.holder = document.querySelector(".page-holder");
    this.display = [document.querySelector(".even-page .page-wrap"),
                    document.querySelector(".odd-page .page-wrap")];
    let pages = Array.from(document.querySelectorAll(".page-holder .page"));
    if (pages.length & 1) {
      // If the number of pages is odd, create a blank final odd page.
      const pg = document.createElement("div");
      document.querySelector(".page-holder").appendChild(pg);
      pg.classList.add("page");
      pages.push(pg);
    }
    this.pairs = pages.reduce((pairs, pg, i) =>
      (i&1? pairs[pairs.length-1].push(pg) : pairs.push([pg])) && pairs, []);
    this.cur = document.getElementById("currentPair");
    this.frwd = document.getElementById("pg-forward");
    this.bkwd = document.getElementById("pg-backward");
    this.pagerIcons = this.landscape? ["right", "left"] : ["down", "up"];
    this.pagerIcons = this.pagerIcons.map(t => "fa-circle-" + t);
    this.noTransitions = false;  // option to turn off page turn transitions
    this.checkPagers();
    this.anim = [document.querySelector(".even-page .animation-control"),
                 document.querySelector(".odd-page .animation-control")].map(
                  el => new AnimationControl(el));
    this.animations = [];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].classList.contains("animation")) {
        this.animations.push(i);
        pages[i]._anim_ctrl_ = this.anim[i & 1];
      }
    }
    const ctl = document.getElementById("pg-control");
    this.pgctl = new SimpleSlider(ctl, ctl.lastElementChild,
                                  0.75, this.rem, true, (frac) => {
      const len = this.pairs.length;
      let p = parseInt(frac * len);
      if (p < 0) p = 0;
      else if (p >= len) p = len - 1;
      this.goTo(p, true);
    });
    // Insert initial pages in their page-wrap before the animation-control:
    for (let i = 0 ; i < 2 ; i++) {
      this.anim[i].control.before(this.pairs[this.current][i]);
    }
    this.setupAnimations(this.pairs[this.current]);
    this.pagerCancel = this.pagerCancel.bind(this);
    this.pagerTrigger = this.pagerTrigger.bind(this);
    this.frwd.addEventListener("pointerdown",
      () => this.pagerStart(this.frwd, 1));
    this.bkwd.addEventListener("pointerdown",
      () => this.pagerStart(this.bkwd, -1));
    window.addEventListener("keydown", e => {
      switch (e.key) {
      case "Home":
        this.goTo(0, true);
        break;
      case "End":
        this.goTo(this.pairs.length-1, true);
        break;
      case "PageUp":
      case "Backspace":
        this.change(-1);
        break;
      case "PageDown":
      case "Enter":
        this.change(1);
        break;
      case " ":
        if (this.liveAnimators & 1) {
          this.anim[0].flash();
          this.anim[0].playPause();
        } else if (this.liveAnimators & 2) {
          this.anim[1].flash();
          this.anim[1].playPause();
        }
        break;
      case "Tab":
        if (this.liveAnimators) {
          // If both pages have animators, toggle 1 bit
          const both = this.liveAnimators & 4;
          if (both) this.liveAnimators ^= 1;
          if (this.liveAnimators & 1) {
            this.anim[0].control.classList.remove("fade");
            if (both) {
              this.anim[1].stop();
              this.anim[1].control.classList.add("fade");
            }
          } else if (this.liveAnimators & 2) {
            this.anim[1].control.classList.remove("fade");
            if (both) {
              this.anim[0].stop();
              this.anim[0].control.classList.add("fade");
            }
          }
        }
        break;
      default:
        return;
      }
      e.preventDefault();
    });
    this._observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target._resize_callback_ === undefined) continue;
        let w, h;
        if (entry.contentBoxSize) {
          const box = entry.contentBoxSize[0];
          [w, h] = [box.inlineSize, box.blockSize];
        } else {
          const box = entry.contentRect;
          [w, h] = [box.width, box.height];
        }
        entry.target._resize_callback_(w, h);
      }
    });
    this.observe_resize(document.body, (w, h) => {
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize);
      this.rem = rem;
      this.landscape = getComputedStyle(
          document.body).getPropertyValue("--orientation") == "landscape";
      this.pagerIcons = this.landscape? ["right", "left"] : ["down", "up"];
      this.pagerIcons = this.pagerIcons.map(t => "fa-circle-" + t);
      this.checkPagers(this.current, this.beating);
      this.pgctl.onResize(rem);
      this.anim[0].slider.onResize(rem);
      this.anim[1].slider.onResize(rem);
    });
    /* Pulse info button if starting on page 0. */
    this.beating = false;
    if (this.current == 0) {
      this.bkwd.children[0].classList.add("fa-bounce");
      this.beating = true;
      setTimeout(() => {
        this.bkwd.children[0].classList.remove("fa-bounce");
        this.beating = false;
      }, 7000);
    }
  }

  get current() {
    return parseInt(this.cur.value);
  }

  set current(number) {
    if (number < 0 || number >= this.pairs.length) return;
    this.cur.value = "" + number;
  }

  get pageFrac() {
    return (this.current + 0.5) / this.pairs.length;
  }

  observe_resize(element, callback) {
    this._observer.observe(element);
    element._resize_callback_ = callback;
  }

  unobserve_resize(element) {
    this._observer.unobserve(element);
    element._resize_callback_ = undefined;
  }

  pagerStart(el, delta) {
    const nxt = this.current + delta;
    if (nxt >= 0 && nxt < this.pairs.length) {  // this is arrow button
      if (this._pager_info_ !== undefined) return;
      const timeout = setTimeout(() => {
        if (this._pager_info_ === undefined) return;
        this._pager_info_[0] = null;
        this.pgctl.activate(this.pageFrac);  // show page slider
      }, 1000);
      this._pager_info_ = [timeout, el, delta];
    }
    el.addEventListener("pointerup", this.pagerTrigger);
    el.addEventListener("pointerout", this.pagerCancel);
  }

  pagerCancel() {
    if (this._pager_info_ === undefined) return;
    let [timeout, el] = this._pager_info_;
    this._pager_info_ = undefined;
    el.removeEventListener("pointerup", this.pagerTrigger);
    el.removeEventListener("pointerout", this.pagerCancel);
    if (timeout) clearTimeout(timeout);
  }

  pagerTrigger() {
    if (this._pager_info_ === undefined) {
      this.showInfo();
      return;
    }
    let [timeout, el, delta] = this._pager_info_;
    this._pager_info_ = undefined;
    el.removeEventListener("pointerup", this.pagerTrigger);
    el.removeEventListener("pointerout", this.pagerCancel);
    if (timeout) {
      clearTimeout(timeout);
      this.change(delta);
    }
  }

  change(delta) {
    this.goTo(this.current + delta);
  }

  goTo(p, noTransition=false) {
    const [cur, nxt, maxp] = [this.current, p, this.pairs.length-1];
    if (nxt == cur) return;
    if (nxt < 0 || nxt > maxp) {
      if (cur == 0) this.showInfo();
      return;
    }
    for (let a of this.anim) a.control.classList.remove("fade");
    const [old_pair, new_pair] = [this.pairs[cur], this.pairs[nxt]];
    if (noTransition || this.noTransitions) {
      for (let i = 0 ; i < 2 ; i++) {
        old_pair[i].before(new_pair[i]);
        new_pair[i].parentElement.removeChild(old_pair[i]);
        old_pair[i].classList.remove("easein", "easeout", "midturn");
        new_pair[i].classList.remove("easein", "easeout", "midturn");
      }
      this.setupAnimations(new_pair);
    } else {
      for (let a of this.anim) a.control.classList.add("hidden");
      for (let el of [this.frwd, this.bkwd]) el.style.display = "none";
      const [i, j] = nxt>cur? [1, 0] : [0, 1];
      const startListening = (el, callback) => {
        el.addEventListener("transitionend", callback);
        el.addEventListener("transitioncancel", callback);
      }
      const stopListening = (el, callback) => {
        el.removeEventListener("transitionend", callback);
        el.removeEventListener("transitioncancel", callback);
      }
      const cleanup = () => {
        /* Clean up after both even and odd have completed. */
        stopListening(new_pair[j], cleanup);
        new_pair[j].classList.remove("easeout");
        new_pair[j].parentElement.removeChild(old_pair[j]);
        for (let a of this.anim) a.control.classList.remove("hidden");
        for (let el of [this.frwd, this.bkwd]) el.style.display = "grid";
        this.setupAnimations(new_pair);
      }
      const halfway = () => {
        /* Clean up after first half. */
        stopListening(old_pair[i], halfway);
        old_pair[i].classList.remove("easein", "midturn");
        new_pair[i].parentElement.removeChild(old_pair[i]);
        /* Second, new even(odd) page rotates to cover old even(odd) page. */
        new_pair[j].classList.add("easeout", "midturn");
        old_pair[j].after(new_pair[j]);
        startListening(new_pair[j], cleanup);
        setTimeout(() => {
          new_pair[j].classList.remove("midturn");  // trigger rotation
        }, 0);
      }
      /* First, old odd(even) page rotates to reveal new odd(even) page. */
      old_pair[i].classList.add("easein");
      old_pair[i].before(new_pair[i]);
      startListening(old_pair[i], halfway);
      setTimeout(() => {
        old_pair[i].classList.add("midturn");  // trigger rotation
      }, 0);
    }
    this.checkPagers(nxt);
    this.current = nxt;
  }

  checkPagers(p, supress=false) {
    if (p === undefined) p = this.current;
    if (!supress && this.beating) {
        this.bkwd.children[0].classList.remove("fa-bounce");
        this.beating = false;
    }
    const maxp = this.pairs.length - 1;
    const icons = this.pagerIcons;
    const allIcons = ["right", "left", "up", "down"].map(t => "fa-circle-"+t);
    allIcons.push("fa-circle-info");
    let clist = this.frwd.children[0].classList;
    clist.remove(...allIcons);
    clist.add((p >= maxp)? allIcons[4] : icons[0]);
    clist = this.bkwd.children[0].classList;
    clist.remove(...allIcons);
    clist.add((p <= 0)? allIcons[4] : icons[1]);
  }

  * animatedPages() {
    // for (let [i, page] of manager.animatedPages()) {...}
    for (let i of this.animations) {
      yield [i, this.pairs[i >> 1][i & 1]];
    }
  }

  setAnimationCallback(page, ms, callback, context) {
    page._anim_ms_ = ms;  // duration
    page._anim_callback_ = callback;
    page._anim_ctx_ = context;
    page._anim_frac_ = 0;
    const pair = this.pairs[this.current];
    if (page == pair[0] || page == pair[1]) this.setupAnimations(pair);
  }

  setupAnimations(pair) {
    let flags = 0;
    for (let i of [0, 1]) {
      const page = pair[i];
      const callback = page._anim_callback_;
      if (callback) {
        page._anim_ctrl_.configure(page._anim_ms_, page._anim_frac_,
                                   callback, page._anim_ctx_);
        flags |= i + 1;
      }
    }
    this.liveAnimators = (flags==3)? 7 : flags;
  }

  showInfo() {
    if (this.beating) {
      this.bkwd.children[0].classList.remove("fa-bounce");
      this.beating = false;
    }
    console.log("showInfo()");
  }
}

class SimpleSlider {
  constructor(control, thumb, margin, rem, hide, callback, context) {
    this.control = control;
    this.thumb = thumb;
    this.parent = thumb.parentElement
    this.margin = margin;  // in rem
    this.hide = hide;
    this.callback = callback;
    this.ctx = context;  // if callback bound to a this, context is ignored
    this.moving = false;
    this.onResize(rem);
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.thumb.addEventListener("pointerdown", this.onDown);
    this.downAlert = undefined;
  }

  onResize(rem) {
    const classList = this.control.classList;
    const hidden = classList.contains("hidden");
    classList.remove("hidden");
    let {top, bottom, right, left} = this.thumb.getBoundingClientRect();
    let dthumb = [right - left, bottom - top];
    ({top, bottom, right, left} = this.parent.getBoundingClientRect());
    if (hidden) classList.add("hidden");
    if (this.moving) this.onUp();
    const width = right - left, height = bottom - top;
    const vertical = height > width, margin = this.margin*rem;
    this.vertical = vertical;
    if (vertical) {
      this.full = height - 2*margin - dthumb[1];
      this.zero = top + margin;
    } else {
      this.full = width - 2*margin - dthumb[0];
      this.zero = left + margin;
    }
    this.offset = 0;  // difference between thumb position and pointer
  }

  get frac() {
    return getComputedStyle(this.control).getPropertyValue("--frac");
  }

  getFrac(x, y) {
    if (y === undefined) {
      ({clientX: x, clientY: y} = x);  // single argument is an event
    }
    let frac = ((this.vertical? y : x) + this.offset - this.zero) / this.full;
    if (frac < 0.) frac = 0.;
    else if (frac > 1.) frac = 1.;
    return frac;
  }

  moveThumb(frac) {
    if (frac < 0.) frac = 0.;
    else if (frac > 1.) frac = 1.;
    this.control.style.setProperty("--frac", "" + frac);
    if (this.callback) this.callback.call(this.ctx, frac);
  }

  activate(fraction) {
    this.moveThumb(fraction);
    this.control.classList.remove("hidden");
  }

  onDown(e) {
    if (this.moving) return;
    if (this.downAlert) this.downAlert();
    const {clientX, clientY} = e;
    const ptr = this.vertical? clientY : clientX;
    const now = this.frac*this.full + this.zero;
    this.offset = now - ptr;  // add to event position to get thumb position
    const thumb = this.thumb;
    thumb.addEventListener("pointermove", this.onMove);
    thumb.addEventListener("pointerup", this.onUp);
    thumb.addEventListener("pointercancel", this.onUp);
    thumb.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;
    this.moving = true;
  }

  onMove(e) {
    if (!this.moving) return;
    this.moveThumb(this.getFrac(e));
  }

  onUp(e) {
    if (!this.moving) return;
    if (e !== undefined) this.moveThumb(this.getFrac(e));
    const thumb = this.thumb;
    thumb.removeEventListener("pointermove", this.onMove);
    thumb.removeEventListener("pointerup", this.onUp);
    thumb.removeEventListener("pointercancel", this.onUp);
    thumb.releasePointerCapture(this.pointerId);
    this.pointerId = undefined;
    this.moving = false;
    if (this.hide) this.control.classList.add("hidden");
  }

  setAlert(callback) {
    this.downAlert = callback;
  }
}

class AnimationControl {
  constructor(control) {
    this.control = control;
    this.play = control.children[0];
    const slide = control.children[1];
    const thumb = slide.children[1];
    this.slider = new SimpleSlider(slide, thumb, 0, 0, false, (frac) => {
      if (!this.callback) return;
      this.callback.call(this.ctx, frac);
    });
    this.slider.setAlert(() => this.stop())
    this.playPause = this.playPause.bind(this);
    this.play.addEventListener("click", this.playPause);
    this.begin = this.reqid = this.callback = this.ctx = null;
    this.duration = 0;
  }

  configure(ms=0, frac0=0, callback=null, context=null) {
    // This must be called whenever page turn changes the animated figure.
    this.reset();
    if (frac0 < 0) frac0 = 0;
    else if (frac0 > 1) frac0 = 1;
    const old_frac = this.slider.frac;
    this.slider.moveThumb(frac0);
    this.duration = (ms > 0)? ms : 0;
    this.callback = callback;
    this.ctx = context;
    return old_frac;   // Option to save most recent position for each page?
  }

  reset(move=true) {
    this.stop();
    if (move) this.slider.moveThumb(0);
    this.control.classList.remove("fade");
  }

  start() {
    if (this.begin || !this.callback) return;
    this.reqid = requestAnimationFrame((timestamp) => this.step(timestamp));
    this.play.firstElementChild.classList.remove("fa-play");
    this.play.firstElementChild.classList.add("fa-pause");
    this.control.classList.add("fade");
  }

  step(timestamp) {
    if (!this.callback) return;
    if (!timestamp) return;  // impossible? or happens at most once
    if (!this.begin) this.begin = timestamp - this.slider.frac*this.duration;
    const elapsed = timestamp - this.begin;
    if (elapsed < 0 || this.duration <= 0) return;
    let frac = elapsed / this.duration;
    if (frac >= 1.0) frac = 1.0;
    this.slider.moveThumb(frac);  // draws frame as side effect
    if (frac < 1) {
      this.reqid = requestAnimationFrame((timestamp) => this.step(timestamp));
    } else {
      this.stop(true);
    }
  }

  stop(nocancel=false) {
    if (!nocancel && this.reqid) {
      cancelAnimationFrame(this.reqid);
      this.reqid = null;
    }
    this.begin = null;
    this.play.firstElementChild.classList.remove("fa-pause");
    this.play.firstElementChild.classList.add("fa-play");
  }

  playPause() {
    if (this.begin !== null) {  /* pause playback */
      this.stop();
    } else if (this.slider.frac > 0.995) {  /* reset playback */
      this.reset();
    } else {  /* resume playback */
      this.start();
    }
  }

  flash() {
    const classList = this.control.classList;
    if (!classList.contains("fade")) return;
    classList.remove("fade");
    setTimeout(() => {
      classList.add("fade");
    }, 20);
  }
}

const manager = new PageManager();
window.manager = manager;

for (let [i, page] of manager.animatedPages()) {
  manager.setAnimationCallback(page, 5000, (frac) => {})
}
