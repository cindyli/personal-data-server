/*
    Copyright 2020 OCAD University.

    Licensed under the BSD-3-Clause license.
*/

"use strict";

module.exports = function (grunt) {
    grunt.config.init({
        lintAll: {
            sources: {
                js:    ["./src/js/**/*.js", "tests/js/**/*.js", "./*.js", "!./src/lib/**/*.js"]
            }
        }
    });
    grunt.loadNpmTasks("fluid-grunt-lint-all");
    grunt.registerTask("lint", "Perform all standard lint checks.", ["lint-all"]);

    grunt.registerTask("default", ["lint"]);
};
