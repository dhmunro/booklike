/* Companion module for ctheme.css to be used in javascript scripts.
 * Supports selenized and solarized color themes.
 *
 * Usage:
 ^
 * import ThemeColors from "ctheme.js";
 * const theme = new ThemeColors();
 *   // colors are now available as theme.bg_0, theme.fg_0, theme.red, etc.
 * 
 * // To change color theme:
 * const html = document.documentElement;
 * theme.change("selenized dark");
 *   // or "solarized light", "selenized white", etc.
 */
class ThemeColors {
    constructor() {
        this.colors = {}
        this.update()
    }

    /* Call theme.update() whenever color theme changes. */
    update() {
        const style = getComputedStyle(document.body);
        for (const c of ["bg_0", "bg_1", "bg_2", "dim_0", "fg_0", "fg_1",
                         "red", "orange", "yellow", "green", "cyan", "blue",
                         "violet", "magenta"]) {
            this.colors[c] = style.getPropertyValue("--" + c);
        }
    }

    /* Call this to change color theme, e.g.- change("solarized dark") */
    change(to) {
        const schemes = ["solarized", "selenized"];
        const modes = ["light", "dark", "white", "black"];
        let scheme, mode;
        for (const v of to.split(/\s+/)) {
            if (scheme === undefined && schemes.some(v => v==x)) {
                scheme = v;
            } else if (mode === undefined && modes.some(v => v==x)) {
                mode = v;
            } else {
                scheme = mode = undefined;
                break
            }
        }
        if (scheme === undefined && mode === undefined) {
            throw new Error("unrecognized color theme")
        }
        if (scheme == "solarized" && (mode == "white" | mode == "black")) {
            throw new Error("solarized scheme has no white or black mode")
        }
        const clist = document.documentElement.classList;
        if (scheme === undefined) {
            if (clist.contains("solarized") && mode!="white" && mode!="black") {
                scheme = "solarized";
            } else {
                scheme = "selenized";
            }
        } else if (mode === undefined) {
            mode = "light";
        }
        clist.remove(...schemes, ...modes);
        clist.add(scheme, mode);
        this.update();
    }

    get bg_0() { return this.colors.bg_0; }
    get bg_1() { return this.colors.bg_1; }
    get bg_2() { return this.colors.bg_2; }
    get dim_0() { return this.colors.dim_0; }
    get fg_0() { return this.colors.fg_0; }
    get fg_1() { return this.colors.fg_1; }
    get red() { return this.colors.red; }
    get orange() { return this.colors.orange; }
    get yellow() { return this.colors.yellow; }
    get green() { return this.colors.green; }
    get cyan() { return this.colors.cyan; }
    get blue() { return this.colors.blue; }
    get violet() { return this.colors.violet; }
    get magenta() { return this.colors.magenta; }
}

export default ThemeColors;
