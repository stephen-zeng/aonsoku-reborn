const { defineConfig } = require("cypress");

module.exports = defineConfig({
  component: {
    specPattern: "src/**/*.cy.{ts,tsx}",
    viewportWidth: 1920,
    viewportHeight: 1080,
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
});
