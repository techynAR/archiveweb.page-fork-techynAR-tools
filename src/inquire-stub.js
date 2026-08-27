"use strict";

module.exports = function inquire(moduleName) {
  if (moduleName === "buffer" && typeof Buffer !== "undefined") {
    return { Buffer };
  }
  return null;
};
