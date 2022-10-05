export default {
  "data/tech/**/*.json": `node data/validate.mjs --type feature --files`,
  "data/tests/**/*.json": `node data/validate.mjs --type test --files`,
};
