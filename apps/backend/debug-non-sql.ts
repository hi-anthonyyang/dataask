import { detectPromptInjection } from "./apps/backend/src/security/promptSanitize";

const nonSQL = "Hello @user, check out #hashtag and [brackets] for \$money!";
console.log("Input:", nonSQL);
const result = detectPromptInjection(nonSQL);
console.log("Result:", result);

const restrictivePattern = /[^\w\s.,!?;:()\-"'<>=]/g;
const matches = nonSQL.match(restrictivePattern);
console.log("Restrictive matches:", matches);
