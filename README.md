# Booklike Web Pages

Booklike is an HTML template, css, and javascript framework that presents a
series of pages two at a time, side by side like a book in a landscape window,
or one atop the other like a calendar in a portrait window.  Advancing the
page mimics turning to the next page of the book, or flipping to the next
moth of the calendar.  The page turning interface is deliberately very simple;
you can either click on the arrows in the corners, or hit the Enter/PgDn or
Backspace/PgUp keys to page forward or backward.  The Home and End keys take
you to the beginning and end of the document.

Booklike supports full page animated figures with a simple control consisting
of a play/pause button and a slider; hitting the space bar also toggles
between play and pause, and the arrow keys step through the animation.

A simple theming engine that understands the popular minimalist solarized and
selenized color schmes is included.  Bookmark splits the associated css and js
files out into an independent sub-package called ctheme.

Finally, booklike has optional support for the PIXI.js 2D drawing engine.
