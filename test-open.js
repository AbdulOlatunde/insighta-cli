const open = (...args) => import("open").then((module) => module.default(...args));

open("https://google.com").then(() => console.log("Done")).catch(err => console.error(err));
