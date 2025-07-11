/* Make a web page resemble a simple book showing two pages at once.
   The pages can be either side by side for landscape layouts, or one
   above the other for portrait or flipbook layouts.
 */
import PageManager from "./booklike.js";

const manager = new PageManager();
window.manager = manager;

for (let [i, page] of manager.animatedPages()) {
  manager.setAnimationCallback(page, 5000, (frac) => {})
}
