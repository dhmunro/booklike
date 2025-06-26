/* Support selenized and solarized color themes together with ctheme.css. */

export default class ThemeColors {
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
