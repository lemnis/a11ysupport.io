// @ts-check
import Ajv from "ajv";
import { existsSync, readFileSync } from "fs";
import ajvKeywords from "ajv-keywords";
import path from "path";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "url";

const excludeFromCSSTest = [
  "/tests/tech/aria/aria-expanded.json",
  "/tests/tech/aria/aria-relevant.json",
  "/tests/tech/aria/aria-required-on-html-radio-buttons.json",
  "/tests/tech/html/required_attribute_radio_group.json",
];

const filePaths = process.argv.slice(process.argv.indexOf("--files") + 1);
const typeIndex = process.argv.indexOf("--type");
const type = typeIndex < 0 ? "test" : process.argv[typeIndex + 1];

const featureSchema = JSON.parse(
  readFileSync("data/schema/dev-feature.json", "utf8")
);
const testSchema = JSON.parse(
  readFileSync("data/schema/dev-test.json", "utf8")
);

const ajv = new Ajv({
  $data: true,
  strictDefaults: true,
  strictKeywords: true,
});
ajvKeywords(ajv);

const validate = ajv.compile(type === "feature" ? featureSchema : testSchema);

/**
 * Loop through nested object to aid to find an element with certain key
 * @param {*} obj (Nested) object to loop through
 * @param {(key: string, value: any) => void} cb
 */
const loop = (obj, cb) => {
  if (Array.isArray(obj)) {
    obj.forEach((item) => loop(item, cb));
  } else if (obj && typeof obj === "object") {
    Object.entries(obj).forEach((item) => {
      cb(...item);
      loop(item, cb);
    });
  }
};

filePaths.map(async (filePath) => {
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  const relativeFilePath = filePath.replace(
    path.dirname(fileURLToPath(import.meta.url)),
    ""
  );
  let htmlFilePath;

  if (data.html_file) {
    // Check local HTML file
    if (!data.html_file.match(/^http(s?):\/\//)) {
      htmlFilePath = path.join("data/tests/html", data.html_file);
      if (!existsSync(htmlFilePath)) {
        console.log(relativeFilePath, `could not find html_file`);
        process.exitCode = 1;
      }
    }
  }

  loop(data, (key, value) => {
    //  Validate CSS selectors
    if (
      key === "css_target" &&
      htmlFilePath &&
      !excludeFromCSSTest.includes(relativeFilePath)
    ) {
      const dom = new JSDOM(readFileSync(htmlFilePath));
      try {
        if (!dom.window.document.querySelector(value)) {
          console.log(relativeFilePath, `could not find css_selector ${value}`);
          process.exitCode = 1;
        }
      } catch (error) {
        console.log(relativeFilePath, error.message);
      }
    }
  });

  // Validate JSON Schema
  if (!validate(data)) {
    console.log(
      relativeFilePath,
      validate.errors?.map(({ message }) => message).join(" &")
    );
    process.exitCode = 1;
  }
});
