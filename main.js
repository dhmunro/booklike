/* Make a web page resemble a simple book showing two pages at once.
   The pages can be either side by side for landscape layouts, or one
   above the other for portrait or flipbook layouts.
 */
import {PageManager, PageActions} from "./booklike.js";

const manager = new PageManager();
window.manager = manager;  // Nice for debugging and sharing with other modules.

// Simple animation example
class Animator extends PageActions {
  constructor(page, ms) {
    super(ms);
    this.page = page;
  }
  show(page) {
    // PageActions defines fraction() method to find current animation frame
    this.drawFrame(this.fraction(page));
  }
  drawFrame(frac) {
    const colors = ["fg_0", "red", "yellow", "green", "blue", "violet"];
    let index = parseInt(6*frac);
    if (index > 5) index = 5;
    this.page.lastElementChild.style.color = manager.theme[colors[index]];
  }
}

for (let [i, page] of manager.animatedPages()) {
  manager.actions({page3: new Animator(page, 6000)});
}
