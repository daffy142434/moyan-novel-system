const fs = require("fs");
const path = require("path");

const projectDir = __dirname;
const episodePattern = /^第(\d+)集_.+\.md$/;

function effectiveUnits(text) {
  const han = text.match(/\p{Script=Han}/gu) || [];
  const latinWords = text.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g) || [];
  const numericTokens = text.match(/\d+(?:[-—]\d+)*/g) || [];
  return han.length + latinWords.length + numericTokens.length;
}

function inspectEpisode(file) {
  const text = fs.readFileSync(path.join(projectDir, file), "utf8");
  const units = effectiveUnits(text);
  const scenes = (text.match(/^## \d+-\d+ .+ (日|夜) (内|外)$/gm) || []).length;
  const peopleLines = (text.match(/^人物：.+$/gm) || []).length;
  const dialogueCandidates = text
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z]+(?: [A-Za-z]+)*（/.test(line));
  const badDialogues = dialogueCandidates.filter(
    (line) => !/^[A-Za-z]+(?: [A-Za-z]+)*（[^）]+）：.+$/.test(line),
  );
  const longDialogues = dialogueCandidates.filter((line) => {
    const content = line.split("：").slice(1).join("：");
    return (content.match(/\p{Script=Han}/gu) || []).length > 30;
  });
  const highRiskTerms =
    text.match(
      /因此|综上|事实上|值得注意的是|我理解你的感受|请你相信我|你要知道/g,
    ) || [];

  const pass =
    units >= 600 &&
    units <= 700 &&
    scenes >= 2 &&
    scenes <= 3 &&
    peopleLines === scenes &&
    badDialogues.length === 0 &&
    longDialogues.length === 0 &&
    highRiskTerms.length === 0;

  return {
    file,
    units,
    scenes,
    peopleLines,
    badDialogues: badDialogues.length,
    longDialogues: longDialogues.length,
    highRiskTerms: highRiskTerms.length,
    pass,
  };
}

const files = fs
  .readdirSync(projectDir)
  .filter((file) => episodePattern.test(file))
  .sort(
    (a, b) =>
      Number(a.match(episodePattern)[1]) - Number(b.match(episodePattern)[1]),
  );

if (files.length === 0) {
  console.error("未找到分集剧本文件。");
  process.exit(1);
}

const results = files.map(inspectEpisode);
console.table(results);

if (results.some((result) => !result.pass)) {
  console.error("规格检查失败：不合格分集不得进入主审。");
  process.exit(1);
}

console.log("规格检查通过。建议创作时将有效字数控制在630—680字。");
