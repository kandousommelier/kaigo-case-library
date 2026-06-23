const FALLBACK_CASES=[];
const PROBLEM_CATEGORIES=["物を探すこと、準備、片付け、移動","仕事の流れ、誰が何をするか、仕事の偏り","記録や書類の作成","連絡、申し送り、みんなに伝えること","目標の共有や改善活動"];
const state={cases:[],query:"",filters:{problem:new Set(),service:new Set(),category:new Set()},sort:"recommended"};
const grid=document.querySelector("#case-grid"),count=document.querySelector("#result-count"),empty=document.querySelector("#empty-state"),dialog=document.querySelector("#case-dialog");
const CSV_FORMATS={old:{type:"old",label:"問題虫めがね 旧版CSV"},new:{type:"new",label:"問題虫めがね 新版CSV"},unknown:{type:"unknown",label:"未対応CSV"}};
const NEW_CSV_NOTICE="新版CSVには、ありたい姿・解決状態・解決方向性・実施する取組・成果指標は含まれていません。改善計画を作成する際は、管理者・活動推進リーダーへの追加確認が必要です。";
const NEW_CSV_UNCONFIRMED={
  desired:"未確認。管理者・活動推進リーダーへの確認が必要",
  resolved:"未確認。改善計画作成時に確認",
  direction:"未確認。関連事例を参考に確認が必要",
  action:"未確認。管理者・活動推進リーダーと決定",
  metric:"未確認。取組内容決定後に設定"
};
async function loadCases(){try{const response=await fetch("cases.json");if(!response.ok)throw new Error();state.cases=await response.json()}catch(error){state.cases=FALLBACK_CASES}buildFilters();render()}
function unique(field){return[...new Set(state.cases.flatMap(item=>Array.isArray(item[field])?item[field]:[item[field]]))]}
function buildFilters(){[{key:"problem",element:"#problem-tags",values:PROBLEM_CATEGORIES},{key:"service",element:"#service-tags",values:unique("service").sort((a,b)=>a.localeCompare(b,"ja"))},{key:"category",element:"#category-tags",values:unique("categories").sort((a,b)=>a.localeCompare(b,"ja"))}].forEach(group=>{const container=document.querySelector(group.element);container.replaceChildren(...group.values.map(value=>{const button=document.createElement("button");button.type="button";button.className="filter-tag";button.textContent=value;button.setAttribute("aria-pressed","false");button.addEventListener("click",()=>toggleFilter(group.key,value,button));return button}))})}
function toggleFilter(type,value,button){const selected=state.filters[type];selected.has(value)?selected.delete(value):selected.add(value);button.setAttribute("aria-pressed",String(selected.has(value)));render()}
function normalized(value){return String(value||"").toLocaleLowerCase("ja").replace(/\s+/g,"")}
function getResults(){const query=normalized(state.query);const results=state.cases.filter(item=>{const searchable=normalized([item.title,item.service,item.problemCategory,item.problemDetails,...item.categories,item.approach,item.outcome,item.tip,item.suitableFor,item.supportUse,item.sourceTitle,item.sourceNote||""].join(" "));return(!query||searchable.includes(query))&&(!state.filters.problem.size||state.filters.problem.has(item.problemCategory))&&(!state.filters.service.size||state.filters.service.has(item.service))&&(!state.filters.category.size||item.categories.some(value=>state.filters.category.has(value)))});return state.sort==="title"?results.sort((a,b)=>a.title.localeCompare(b.title,"ja")):results}
function render(){const results=getResults();count.textContent=results.length;grid.replaceChildren(...results.map(createCard));empty.hidden=results.length!==0;grid.hidden=results.length===0}
function createCard(item){const card=document.querySelector("#case-template").content.firstElementChild.cloneNode(true);card.querySelector(".service-label").textContent=item.service;card.querySelector(".case-number").textContent="CASE "+String(item.id).padStart(2,"0");card.querySelector(".case-title").textContent=item.title;card.querySelector(".case-source").textContent="出典："+item.sourceTitle;card.querySelector(".case-problem").textContent=item.problemCategory;card.querySelector(".case-outcome").textContent=item.outcome;card.querySelector(".case-tip").textContent=item.tip;card.querySelector(".case-suitable").textContent=item.suitableFor;card.querySelector(".category-list").replaceChildren(...item.categories.map(value=>{const tag=document.createElement("span");tag.className="category-chip";tag.textContent=value;return tag}));card.querySelector(".detail-button").addEventListener("click",()=>openDetail(item));card.querySelector(".plan-case-button").addEventListener("click",()=>createPlanFromCase(item));return card}
function openDetail(item){const content=document.querySelector("#dialog-content");content.replaceChildren();const service=document.createElement("p");service.className="dialog-service";service.textContent=item.service+" / "+item.problemCategory;const title=document.createElement("h2");title.id="dialog-title";title.textContent=item.title;const sourceMeta=document.createElement("p");sourceMeta.className="dialog-source";sourceMeta.textContent="出典："+item.sourceTitle+(item.sourcePage?"（"+item.sourcePage+"）":item.sourceNote?"（"+item.sourceNote+"）":"");content.append(service,title,sourceMeta);[["困っていたこと",item.problemDetails],["取り組んだこと",item.approach],["成果",item.outcome],["真似できるポイント",item.tip],["この事例が向いている施設",item.suitableFor],["伴走支援での使い方",item.supportUse]].forEach(([heading,text])=>{const block=document.createElement("section");block.className="dialog-block";const h3=document.createElement("h3");h3.textContent=heading;const p=document.createElement("p");p.textContent=text;block.append(h3,p);content.append(block)});const link=document.createElement("a");link.className="source-link";link.href=item.sourcePdf||item.source;link.target="_blank";link.rel="noopener noreferrer";link.textContent="出典リンクを開く ↗";content.append(link);const planButton=document.createElement("button");planButton.type="button";planButton.className="dialog-plan-button";planButton.textContent="この事例をもとに計画を作る";planButton.addEventListener("click",()=>{dialog.close();createPlanFromCase(item)});content.append(planButton);dialog.showModal()}
function reset(){state.query="";Object.values(state.filters).forEach(set=>set.clear());document.querySelector("#search-input").value="";document.querySelectorAll(".filter-tag").forEach(button=>button.setAttribute("aria-pressed","false"));render()}
document.querySelector("#search-form").addEventListener("submit",event=>{event.preventDefault();state.query=document.querySelector("#search-input").value.trim();render();document.querySelector("#library-title").scrollIntoView({behavior:"smooth",block:"start"})});
document.querySelector("#search-input").addEventListener("input",event=>{state.query=event.target.value.trim();render()});
document.querySelector("#sort-select").addEventListener("change",event=>{state.sort=event.target.value;render()});
document.querySelector("#reset-button").addEventListener("click",reset);document.querySelector("#empty-reset").addEventListener("click",reset);document.querySelector("#dialog-close").addEventListener("click",()=>dialog.close());dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
const Q1_CATEGORY_MAP={
  "移動・準備・間接業務":["物を探すこと、準備、片付け、移動"],
  "記録・情報共有":["記録や書類の作成","連絡、申し送り、みんなに伝えること"],
  "直接ケア・支援の進め方":["仕事の流れ、誰が何をするか、仕事の偏り"],
  "会議・役割分担・改善の進め方":["仕事の流れ、誰が何をするか、仕事の偏り","目標の共有や改善活動"],
  "人材・働き方":["仕事の流れ、誰が何をするか、仕事の偏り","目標の共有や改善活動"]
};
const DIRECTION_CATEGORY_MAP={
  "道具（ICT）":["ICT活用","記録の効率化","情報共有"],
  "道具（介護テクノロジー）":["介護ロボット","安全な介護","業務の見直し"],
  "運用ルール":["標準化","手順書の作成","マニュアル作成"],
  "業務プロセス変更":["業務の見直し","役割分担"],
  "制度設計":["人材育成","改善活動","標準化"]
};
let csvIssues=[];
function parseCSV(text){
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++}
    else if(ch==='"'){quoted=!quoted}
    else if(ch===","&&!quoted){row.push(cell);cell=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=""}
    else cell+=ch
  }
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2)return[];
  const headers=rows[0].map((h,i)=>i===0?h.replace(/^\uFEFF/,"").trim():h.trim());
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])));
}
function csvValue(row,key){const exact=Object.keys(row).find(h=>h===key);if(exact)return row[exact];const prefix=key.split("｜")[0];const found=Object.keys(row).find(h=>h.startsWith(prefix+"｜")||h.startsWith(prefix+"|")||h===prefix);return found?row[found]:""}
function headerByParts(row,parts){return Object.keys(row).find(header=>parts.every(part=>header.includes(part)))}
function valueByParts(row,parts){const header=headerByParts(row,parts);return header?row[header]:""}
function newCsvBasicValue(row,number,keyword){return valueByParts(row,["設問"+number,keyword])}
function newCsvBlockValue(row,block,number){return valueByParts(row,["設問"+block+number])}
function detectCsvFormat(rows){
  const headers=Object.keys(rows[0]||{});
  const hasNew=headers.some(h=>h.includes("設問1")&&h.includes("サービス"))&&headers.some(h=>h.includes("設問2")&&h.includes("立場"))&&headers.some(h=>h.includes("設問3")&&h.includes("最も気になっている"))&&headers.some(h=>h.includes("設問A1"));
  if(hasNew)return CSV_FORMATS.new;
  const hasOld=headers.some(h=>/^Q[1-7](\b|｜|\||$)/.test(h))||headers.some(h=>h.includes("Q1｜")||h.includes("Q2｜")||h.includes("Q3｜"));
  if(hasOld)return CSV_FORMATS.old;
  return CSV_FORMATS.unknown;
}
function mapByIncludes(value,map){const result=[];Object.entries(map).forEach(([label,values])=>{if(String(value||"").includes(label))values.forEach(v=>{if(!result.includes(v))result.push(v)})});return result}
function addUnique(target,items){items.forEach(item=>{if(item&&!target.includes(item))target.push(item)})}
function categoriesFromNewCsvIssue(issue){
  const text=[issue.problemCategory,issue.selectedProblem,issue.impact,issue.timing,issue.location].join(" ");
  const categories=[];
  if(/記録|書類|帳票|入力|転記/.test(text))addUnique(categories,["記録の効率化","標準化"]);
  if(/連絡|申し送り|共有|伝達|会議/.test(text))addUnique(categories,["情報共有","標準化"]);
  if(/探す|準備|片付け|移動|物品|書類|置き場/.test(text))addUnique(categories,["5S活動","業務の見直し"]);
  if(/流れ|役割|偏り|分担|人手|配置|重な/.test(text))addUnique(categories,["業務の見直し","役割分担"]);
  if(/目標|改善|活動|リーダー|管理者/.test(text))addUnique(categories,["改善活動","標準化"]);
  if(/安全|ミス|事故|確認漏れ|漏れ|品質/.test(text))addUnique(categories,["安全な介護","標準化"]);
  return categories;
}
function activeNewCsvBlock(row){return ["A","B","C","D","E","F","G"].find(block=>newCsvBlockValue(row,block,1))||""}
function problemCurrentText(issue){
  return [["頻度",issue.frequency],["場面",issue.timing],["場所",issue.location],["困っていること",issue.impact],["継続期間",issue.duration]].filter(([,value])=>value).map(([label,value])=>label+"："+value).join("\n");
}
function frequencyScore(value){const text=String(value||"");if(/常に|いつも|毎日|よく|頻繁|多い/.test(text))return 5;if(/週|しばしば|ときどき|時々/.test(text))return 3;if(/たまに|まれ/.test(text))return 1;return 2}
function durationScore(value){const text=String(value||"");if(/半年以上|以前から|ずっと|長期間|1年|一年|数年/.test(text))return 5;if(/3か月|三か月|数か月|数ヶ月/.test(text))return 3;if(/最近|今月|先月/.test(text))return 1;return 2}
function impactScore(value){const text=String(value||"");let score=0;if(/残業|時間がかか|休憩|負担|疲/.test(text))score+=3;if(/確認漏れ|漏れ|ミス|事故|安全|リスク/.test(text))score+=4;if(/品質|サービス|利用者|家族|不安|ストレス/.test(text))score+=2;return Math.min(score,6)}
function calculateOldCsvIssues(rows){
  const raw=rows.map((row,index)=>({
    id:index+1,csvFormat:"old",csvFormatLabel:CSV_FORMATS.old.label,office:csvValue(row,"事業所名"),service:csvValue(row,"事業所種別"),role:csvValue(row,"回答者の立場"),
    theme:csvValue(row,"Q1｜今回のワークで扱うテーマ"),currentItems:csvValue(row,"Q2｜今の現場で当てはまるもの"),
    current:csvValue(row,"Q3｜今の現場の状態を一言で表してください"),desired:csvValue(row,"Q4｜こうなっていたらいいなと思う状態"),
    gap:csvValue(row,"Q5｜現状との差が一番大きいもの"),resolved:csvValue(row,"Q6｜この問題が解決された状態"),
    direction:csvValue(row,"Q7｜課題を解決するための方向性")
  })).filter(x=>x.theme||x.current||x.gap);
  const themeCounts={},gapCounts={},roles={};
  raw.forEach(x=>{themeCounts[x.theme]=(themeCounts[x.theme]||0)+1;gapCounts[x.gap]=(gapCounts[x.gap]||0)+1;(roles[x.theme]||(roles[x.theme]=new Set())).add(x.role)});
  return raw.map(x=>{
    const easy=x.direction.includes("運用ルール")||x.direction.includes("業務プロセス変更")?3:x.direction.includes("制度設計")?1:2;
    const score=Math.round((themeCounts[x.theme]||1)*2+(gapCounts[x.gap]||1)*1.5+(roles[x.theme]?.size||1)*2+easy);
    return {...x,title:x.gap||x.current||x.theme+"の改善",problemCategories:mapByIncludes(x.theme,Q1_CATEGORY_MAP),categories:mapByIncludes(x.direction,DIRECTION_CATEGORY_MAP),priorityScore:score,priorityReason:"同テーマ "+(themeCounts[x.theme]||1)+"件・同じギャップ "+(gapCounts[x.gap]||1)+"件・回答者立場 "+(roles[x.theme]?.size||1)+"種類"+(x.direction.includes("制度設計")?"。中長期テーマとして整理":"。着手しやすさを加味")};
  }).sort((a,b)=>b.priorityScore-a.priorityScore);
}
function calculateNewCsvIssues(rows){
  const raw=rows.map((row,index)=>{
    const activeBlock=activeNewCsvBlock(row);
    const selectedProblem=activeBlock?newCsvBlockValue(row,activeBlock,1):"";
    const issue={
      id:index+1,csvFormat:"new",csvFormatLabel:CSV_FORMATS.new.label,office:"",sourceRow:index+1,activeBlock,
      service:newCsvBasicValue(row,1,"サービス"),role:newCsvBasicValue(row,2,"立場"),
      problemCategory:newCsvBasicValue(row,3,"最も気になっている"),theme:newCsvBasicValue(row,3,"最も気になっている"),
      selectedProblem,frequency:activeBlock?newCsvBlockValue(row,activeBlock,2):"",timing:activeBlock?newCsvBlockValue(row,activeBlock,3):"",location:activeBlock?newCsvBlockValue(row,activeBlock,4):"",impact:activeBlock?newCsvBlockValue(row,activeBlock,5):"",duration:activeBlock?newCsvBlockValue(row,activeBlock,6):""
    };
    issue.title=issue.selectedProblem||issue.problemCategory||"未選択の課題";
    issue.currentItems=issue.selectedProblem;
    issue.current=problemCurrentText(issue)||"頻度・場面・場所・影響・継続期間は未入力です。";
    issue.desired=NEW_CSV_UNCONFIRMED.desired;
    issue.gap="仮："+(issue.impact||issue.selectedProblem||"影響内容の確認が必要");
    issue.resolved=NEW_CSV_UNCONFIRMED.resolved;
    issue.direction=NEW_CSV_UNCONFIRMED.direction;
    issue.action=NEW_CSV_UNCONFIRMED.action;
    issue.metric=NEW_CSV_UNCONFIRMED.metric;
    issue.problemCategories=issue.problemCategory?[issue.problemCategory]:[];
    issue.categories=categoriesFromNewCsvIssue(issue);
    issue.keywords=[issue.problemCategory,issue.selectedProblem,issue.impact,issue.timing,issue.location,issue.service,issue.role].filter(Boolean).join(" ");
    return issue;
  }).filter(issue=>issue.problemCategory||issue.selectedProblem||issue.impact);
  const problemCounts={},categoryCounts={},rolesByProblem={};
  raw.forEach(issue=>{problemCounts[issue.selectedProblem]=(problemCounts[issue.selectedProblem]||0)+1;categoryCounts[issue.problemCategory]=(categoryCounts[issue.problemCategory]||0)+1;(rolesByProblem[issue.selectedProblem]||(rolesByProblem[issue.selectedProblem]=new Set())).add(issue.role)});
  return raw.map(issue=>{
    const sameProblem=problemCounts[issue.selectedProblem]||1,sameCategory=categoryCounts[issue.problemCategory]||1,roleCount=rolesByProblem[issue.selectedProblem]?.size||1;
    const score=Math.round(sameProblem*3+sameCategory*1.5+roleCount*2+frequencyScore(issue.frequency)+durationScore(issue.duration)+impactScore(issue.impact));
    const reasons=["同じ課題 "+sameProblem+"件","同じ困りごと分類 "+sameCategory+"件","回答者の立場 "+roleCount+"種類","頻度："+(issue.frequency||"未入力"),"継続期間："+(issue.duration||"未入力"),"影響："+(issue.impact||"未入力")];
    return {...issue,priorityScore:score,priorityReason:reasons.join("・")};
  }).sort((a,b)=>b.priorityScore-a.priorityScore);
}
function calculateCsvIssues(rows,format=detectCsvFormat(rows)){if(format.type==="new")return calculateNewCsvIssues(rows);if(format.type==="old")return calculateOldCsvIssues(rows);return[]}
function plannerTokens(text){return String(text||"").toLocaleLowerCase("ja").split(/[、,・。/／\s]+/).map(value=>value.trim()).filter(value=>value.length>1)}
function findRelatedCases(issue,limit=5){
  const keywords=plannerTokens([issue.title,issue.current,issue.desired,issue.gap,issue.resolved,issue.keywords,issue.problemCategory,issue.selectedProblem,issue.impact,issue.timing,issue.location,issue.service,issue.role].join(" "));
  return state.cases.map(item=>{
    let score=0;if(issue.problemCategories?.includes(item.problemCategory)||issue.problemCategory===item.problemCategory)score+=8;
    (issue.categories||[]).forEach(c=>{if(item.categories.includes(c))score+=4});
    if(issue.service&&item.service&&(item.service.includes(issue.service)||issue.service.includes(item.service)))score+=5;
    const hay=normalized([item.title,item.service,item.problemCategory,item.problemDetails,item.approach,item.outcome,item.tip,item.suitableFor,item.supportUse,...(item.categories||[])].join(" "));
    keywords.forEach(k=>{if(hay.includes(normalized(k)))score+=2});
    return{item,score}
  }).sort((a,b)=>b.score-a.score||a.item.id-b.item.id).slice(0,Math.max(3,limit)).map(x=>x.item);
}
const CASE_PLAN_OVERRIDES={
  1005:{
    problemDetails:"記録業務など、実際には実施しているが業務表に載っていない業務があった。実際の業務と業務表に乖離があり、業務表に載っていない業務の実施タイミングも職員により異なっていた。",
    approach:"業務時間調査を実施し、業務を10分単位で見える化した。業務時間調査結果と現場ヒアリングから、業務表と実際の業務の差を把握し、業務の役割分担や実施タイミングを明確にした業務表を作成した。",
    outcome:"職員の業務時間に対する意識が高まった。",
    tip:"対象業務を絞って業務時間を記録し、業務表と実際の動きの差を職員で共有する。"
  }
};
function directionText(issue){return issue.direction||issue.categories?.join("、")||"業務の見直しと小さな試行"}
function firstTwoWeeks(issue){
  const d=directionText(issue);
  if(d.includes("制度設計"))return"1. 関係職種から小チームを選ぶ\n2. 現状と対象範囲を合意する\n3. 必要な制度・教育の論点を整理する";
  if(d.includes("ICT")||d.includes("テクノロジー"))return"1. 現在の業務工程と二度手間を記録する\n2. 1場面・少人数で道具を試す\n3. 操作と安全上の気づきを集める";
  if(d.includes("運用ルール"))return"1. 現在のやり方を職員3名以上から聞く\n2. 必須手順を一枚にまとめる\n3. 1週間試して直す";
  return"1. 対象業務の流れと所要時間を書き出す\n2. 役割・順番を一つだけ変えて試す\n3. 実施前後の困りごとを記録する";
}
function metricText(issue){
  const p=issue.problemCategories?.join(" ")||"";
  if(p.includes("記録"))return"記録・書類にかかる時間、転記回数、未記入件数";
  if(p.includes("連絡"))return"確認回数、伝達漏れ件数、申し送り時間";
  if(p.includes("物を探す"))return"探し物の回数・時間、準備の往復回数";
  return"対象業務の所要時間、職員の負担感、利用者と関わる時間";
}
function isUnverifiedCase(item){return!CASE_PLAN_OVERRIDES[item.id]&&/未精査|簡易カード/.test(item.sourceNote||"")}
function casePlanItem(item){return{...item,...(CASE_PLAN_OVERRIDES[item.id]||{})}}
function caseSourceText(item){
  const title=item.sourceTitle||item.sourceType||"出典資料";
  const page=item.sourcePage?"（"+item.sourcePage+"）":"";
  const url=item.sourcePdf||item.source||"出典リンクは自施設で確認する";
  return title+page+"\n"+url;
}
function caseReferenceText(item){return"事例タイトル："+item.title+"\nサービス種別："+item.service+"\n困りごと分類："+item.problemCategory+"\n出典："+caseSourceText(item)}
function splitCaseStatements(value){const parts=String(value||"").split(/[。\n]+/).map(text=>text.trim()).filter(Boolean);return parts.length?parts.map(text=>"・"+text+"。").join("\n"):"・出典PDFで取組内容を確認する。"}
function sameCaseText(a,b){return String(a||"").replace(/\s+/g,"").replace(/[。、「」]/g,"")===String(b||"").replace(/\s+/g,"").replace(/[。、「」]/g,"")}
function caseProblemText(item){if(!item.problemDetails||isUnverifiedCase(item)&&sameCaseText(item.problemDetails,item.title))return"現在の簡易カードでは課題の詳細が十分に整理されていません。出典PDFで「困っていたこと」を確認してください。";return item.problemDetails}
function caseApproachText(item){const text=splitCaseStatements(item.approach);return isUnverifiedCase(item)?text+"\n・詳細な手順と実施条件は出典PDFで確認する。":text}
function caseOutcomeText(item){if(!item.outcome)return"出典PDFで成果を確認してください。";if(isUnverifiedCase(item))return"現在の簡易カードには「"+item.outcome+"」と記載されています。出典PDFの成果欄は未精査のため、確認前は成果として断定しません。";return item.outcome}
function caseCategoryCheck(item){
  if(item.problemCategory?.includes("記録"))return"記録する場面、記録項目、転記や二重入力、入力する人の違いを確認する。";
  if(item.problemCategory?.includes("連絡"))return"何を、誰に、いつ、どの方法で伝えているかと、確認漏れがないかを確認する。";
  if(item.problemCategory?.includes("物を探す"))return"必要な物の置き場所、準備・片付けの手順、探し物や往復が生じる場面を確認する。";
  if(item.problemCategory?.includes("目標"))return"改善の目的、進める役割、話し合いと振り返りの方法が共有されているか確認する。";
  return"業務表と実際の動き、職員ごとの実施タイミング、役割分担の違いを確認する。";
}
function caseCurrentCheck(item){const problem=caseProblemText(item);const first=problem.startsWith("現在の簡易カード")?"出典PDFで事例の課題を確認したうえで、自施設の同じ業務場面を確認する。":"自施設でも、「"+problem+"」と同じ状況がないか確認する。";return first+"\n"+caseCategoryCheck(item)}
function caseDesiredText(item){
  if(item.problemCategory?.includes("記録"))return"記録の目的、項目、入力手順が確認され、職員が同じ認識で記録を残せる状態を目指す。";
  if(item.problemCategory?.includes("連絡"))return"共有する情報、相手、時点、方法が確認され、必要な情報を職員が同じ認識で扱える状態を目指す。";
  if(item.problemCategory?.includes("物を探す"))return"必要な物の置き場所と準備・片付けのルールが確認され、職員が迷わず扱える状態を目指す。";
  if(item.problemCategory?.includes("目標"))return"改善の目的、役割、振り返り方法が確認され、職員が同じ認識で改善を続けられる状態を目指す。";
  return"業務の流れ、役割分担、実施タイミングが見える化され、職員が同じ認識で業務を進められる状態を目指す。";
}
function shortCaseText(value,max=72){const text=String(value||"").replace(/\s+/g," ").trim();return text.length>max?text.slice(0,max-1)+"…":text}
function caseFirstTwoWeeks(item){
  const text=[item.title,item.approach,item.tip].join(" ");
  if(/業務時間調査|タイムスタディ/.test(text))return"1. 対象業務を1つ選ぶ\n2. 2日間、業務を10分単位で記録する\n3. 業務表に載っている業務と、実際に行っている業務の差を確認する\n4. 職員ごとの実施タイミングや役割の違いを整理する\n5. 業務表または役割分担表のたたき台を作る";
  if(item.problemCategory?.includes("物を探す")||(item.categories||[]).includes("5S活動"))return"1. 探し物や準備の負担がある場所を1か所選ぶ\n2. 現在の置き場所と使う人を写真・メモで確認する\n3. 事例の取組「"+shortCaseText(item.approach)+"」を参考に、必要・不要と定位置の案を作る\n4. 真似できるポイント「"+shortCaseText(item.tip)+"」を使い、戻し方のルールを決める\n5. 1週間試して、迷った場面を記録する";
  if(item.problemCategory?.includes("記録"))return"1. 見直す記録・帳票を1つ選ぶ\n2. 作成、確認、転記、保管までの現在の流れを書き出す\n3. 事例の取組「"+shortCaseText(item.approach)+"」を参考に、減らせる手順と残すべき情報を分ける\n4. 真似できるポイント「"+shortCaseText(item.tip)+"」を使い、書式または入力手順の案を作る\n5. 少人数で1週間試し、入力しにくい点を集める";
  if(item.problemCategory?.includes("連絡"))return"1. 見直す申し送り・連絡場面を1つ選ぶ\n2. 現在、何を誰にいつ伝えているかを書き出す\n3. 事例の取組「"+shortCaseText(item.approach)+"」を参考に、必要情報と伝達方法の案を作る\n4. 真似できるポイント「"+shortCaseText(item.tip)+"」を使い、確認方法を決める\n5. 1週間試し、伝わりにくかった内容を集める";
  if(item.problemCategory?.includes("目標")||(item.categories||[]).includes("人材育成"))return"1. 改善対象と参加する職員を決める\n2. 現在の理解・困りごとを短い聞き取りで確認する\n3. 事例の取組「"+shortCaseText(item.approach)+"」を参考に、話し合い・研修の案を作る\n4. 真似できるポイント「"+shortCaseText(item.tip)+"」を進め方に反映する\n5. 1回試し、理解できた点と追加確認を集める";
  return"1. 見直す業務場面を1つ選ぶ\n2. 実際の流れ、時刻、担当を職員ごとに記録する\n3. 事例の取組「"+shortCaseText(item.approach)+"」を参考に、違いと重なりを整理する\n4. 真似できるポイント「"+shortCaseText(item.tip)+"」を使い、役割・手順の案を作る\n5. 小さく試し、職員の気づきを集める";
}
function caseMonthChecks(item){
  if(/業務時間調査|タイムスタディ/.test([item.title,item.approach,item.tip].join(" ")))return"・職員が業務時間に対する気づきを共有できたか\n・業務表と実際の業務の差が整理されたか\n・見直し候補の業務を抽出できたか\n・業務表や役割分担表の修正案を作成できたか";
  const lines=["・最初の2週間で決めた確認・試行を実施できたか","・自施設の現状と事例の取組の違いを職員で共有できたか","・真似できるポイント「"+shortCaseText(item.tip,56)+"」を自施設で続けられる形に直せたか"];
  if(!isUnverifiedCase(item)&&item.outcome)lines.push("・事例の成果「"+shortCaseText(item.outcome,64)+"」に対応する変化が自施設にあるか確認できたか");
  else lines.push("・出典未精査の成果を前提にせず、自施設で確認できた変化を記録できたか");
  return lines.join("\n");
}
function caseRoles(item){
  if(/業務時間調査|タイムスタディ/.test([item.title,item.approach,item.tip].join(" ")))return"・推進リーダー：業務時間調査の準備と集計\n・現場職員：業務内容と実施時刻の記録\n・管理者：見直し対象業務の決定と業務表修正の承認\n・支援者：調査結果の整理と改善案作成の支援";
  if(item.problemCategory?.includes("記録"))return"・推進リーダー：対象記録と確認期間の設定\n・現場職員：現在の記録工程と使いにくい点の記録\n・管理者：残す情報と変更案の承認\n・支援者：工程整理と書式・運用案の作成支援";
  if(item.problemCategory?.includes("連絡"))return"・推進リーダー：対象場面と必要情報の整理\n・現場職員：現在の伝達方法と伝わりにくい内容の記録\n・管理者：共有ルールと試行範囲の承認\n・支援者：情報整理と運用案の作成支援";
  if(item.problemCategory?.includes("物を探す"))return"・推進リーダー：対象場所と確認日の設定\n・現場職員：必要・不要、使用頻度、迷う場面の記録\n・管理者：廃棄・保管・定位置ルールの承認\n・支援者：整理基準と維持方法の作成支援";
  if(item.problemCategory?.includes("目標"))return"・推進リーダー：話し合い・研修の準備と記録\n・現場職員：困りごとと実施後の気づきの共有\n・管理者：改善目的と継続方法の決定\n・支援者：論点整理と振り返りの支援";
  return"・推進リーダー：対象業務の記録準備と違いの整理\n・現場職員：実際の流れ、時刻、役割の記録\n・管理者：試す役割・手順と変更案の承認\n・支援者：業務整理と改善案作成の支援";
}
function caseMetrics(item){
  if(/業務時間調査|タイムスタディ/.test([item.title,item.approach,item.tip].join(" ")))return"・業務時間調査を実施できたか\n・業務表と実際の業務の差を整理できたか\n・職員が業務時間に対する気づきを共有できたか\n・見直し候補の業務を抽出できたか";
  const base=["・対象とした業務・場面の現状確認を実施できたか","・事例の取組を自施設向けに置き換えた案を作成できたか"];
  if(item.problemCategory?.includes("記録"))base.push("・記録工程の重複・迷い・確認事項を整理できたか");
  else if(item.problemCategory?.includes("連絡"))base.push("・必要情報、伝える相手・時点・方法を整理できたか");
  else if(item.problemCategory?.includes("物を探す"))base.push("・必要・不要、定位置、戻し方を整理できたか");
  else if(item.problemCategory?.includes("目標"))base.push("・改善目的と継続方法を職員で確認できたか");
  else base.push("・業務の流れ、時刻、役割の違いを整理できたか");
  base.push("・試行で得た職員の気づきを共有できたか");
  return base.join("\n");
}
function caseAttention(item){
  if(item.id===1005)return"この段階では、時間削減を成果として断定せず、まず業務の見える化と職員の気づきの共有を成果として扱う。";
  if(isUnverifiedCase(item))return"この事例はPDF一覧から作成した未精査の簡易カードです。記載された成果を確定事項として扱わず、出典PDFの本文を確認してください。自施設では、まず現状確認と職員の気づきの共有を成果として扱います。";
  return"事例と同じ成果が自施設でも得られると断定せず、利用者への影響と職員の負担を確認しながら小さく試します。数値は自施設で測定できたものだけを使います。";
}
function buildCasePlan(rawItem){const item=casePlanItem(rawItem);return{issue:item,related:[],showRelated:false,fields:[["参考にした事例",caseReferenceText(item)],["事例で確認された課題",caseProblemText(item)],["事例で行った取組",caseApproachText(item)],["事例で確認された成果",caseOutcomeText(item)],["自施設で確認する現状",caseCurrentCheck(item)],["自施設のありたい姿",caseDesiredText(item)],["最初の2週間でやること",caseFirstTwoWeeks(item)],["1か月後の確認ポイント",caseMonthChecks(item)],["役割分担",caseRoles(item)],["成果指標",caseMetrics(item)],["注意点",caseAttention(item)]]}}
function newCsvKnownText(issue){return["課題："+(issue.selectedProblem||"未入力"),"サービス種別："+(issue.service||"未入力"),"回答者の立場："+(issue.role||"未入力"),"困りごと分類："+(issue.problemCategory||"未入力"),issue.current].filter(Boolean).join("\n")}
function newCsvConfirmationQuestions(issue){return["ありたい姿はどのような状態ですか", "この課題が解決された状態を、職員・利用者の行動で表すと何ですか", "解決方向性は、運用ルール・業務プロセス変更・ICT活用・人材育成などのどれに近いですか", "実施する取組を誰が、いつから、どの範囲で試しますか", "成果指標は何を、いつ、どの方法で確認しますか", "関連事例を参考にする場合、自施設でそのまま使える点と修正が必要な点は何ですか"].join("\n")}
function buildNewCsvPlan(issue){
  const related=findRelatedCases(issue,5);
  const relatedText=related.length?related.slice(0,5).map((item,index)=>(index+1)+". "+item.title+"（"+item.service+" / "+item.problemCategory+"）").join("\n"):"関連する参考候補は、管理者・活動推進リーダーへの確認後に再検索してください。";
  return{title:"追加確認が必要な計画案",issue,related,relatedHeading:"参考候補",showRelated:true,fields:[
    ["このCSVから分かる課題",newCsvKnownText(issue)],
    ["優先度が高い理由",issue.priorityReason],
    ["関連する参考事例",relatedText],
    ["管理者・活動推進リーダーに確認すべき事項",newCsvConfirmationQuestions(issue)],
    ["確認後に計画書へ反映する項目","・ありたい姿\n・解決された状態\n・解決方向性\n・実施する取組\n・成果指標\n・自施設で採用する参考事例の要素"],
    ["注意点",NEW_CSV_NOTICE+"\nこのCSVだけで完成版の改善計画案とはせず、課題選定と確認事項の整理に使います。"]
  ]};
}
function buildPlan(issue){
  if(issue.planSource==="case")return buildCasePlan(issue);
  if(issue.csvFormat==="new")return buildNewCsvPlan(issue);
  const related=findRelatedCases(issue);
  const current=issue.current||issue.currentItems||issue.problemDetails||"現場の状況をチームで確認する";
  const desired=issue.desired||issue.resolved||issue.outcome||"職員が迷わず安全に業務を進められる状態";
  return{issue,related,showRelated:true,fields:[["課題名",issue.title],["現状",current],["ありたい姿",desired],["優先順位の理由",issue.priorityReason||"選択した課題・事例を起点に、現場で小さく試せる内容として整理"],["取り組む方向性",directionText(issue)],["最初の2週間でやること",firstTwoWeeks(issue)],["1か月後の確認ポイント","試行を続けるか、手順を修正するか、対象を広げるかをチームで確認する"],["役割分担","推進役：日程と記録／現場リーダー：試行の調整／担当職員：実施と気づきの共有／管理者：判断と支援"],["成果指標",metricText(issue)],["注意点","数値だけで評価せず、利用者への影響と職員の負担を確認する。最初から全体展開せず小さく試す。"]]};
}
function planText(plan){const fields=plan.fields.map(([h,v])=>"【"+h+"】\n"+v).join("\n\n");if(plan.showRelated===false)return fields;return fields+"\n\n【"+(plan.relatedHeading||"参考事例")+"】\n"+plan.related.map((x,i)=>(i+1)+". "+x.title+"（"+x.service+"）").join("\n")}
function renderPlan(issue){
  const plan=buildPlan(issue),output=document.querySelector("#plan-output");output.hidden=false;output.replaceChildren();
  const head=document.createElement("div");head.className="plan-output-head";const title=document.createElement("h3");title.textContent=plan.title||"改善計画のたたき台";const copy=document.createElement("button");copy.type="button";copy.className="copy-plan-button";copy.textContent="計画案をコピー";copy.addEventListener("click",()=>copyPlan(plan,copy));head.append(title,copy);
  const fields=document.createElement("div");fields.className="plan-fields";
  plan.fields.forEach(([heading,value])=>{const block=document.createElement("section");block.className="plan-field";const h=document.createElement("h4");h.textContent=heading;const p=document.createElement("p");p.textContent=value;block.append(h,p);fields.append(block)});
  if(plan.showRelated!==false){const related=document.createElement("section");related.className="plan-field related-cases";const rh=document.createElement("h4");rh.textContent=plan.relatedHeading||"参考事例";const list=document.createElement("div");list.className="related-case-list";plan.related.forEach(item=>{const card=document.createElement("div");card.className="related-case";const strong=document.createElement("strong");strong.textContent=item.title;const meta=document.createElement("span");meta.textContent=item.service+" / "+item.problemCategory;card.append(strong,meta);list.append(card)});related.append(rh,list);fields.append(related)}
  output.append(head,fields);output.scrollIntoView({behavior:"smooth",block:"start"});
}
async function copyPlan(plan,button){const text=planText(plan);try{await navigator.clipboard.writeText(text)}catch(error){const area=document.createElement("textarea");area.value=text;document.body.append(area);area.select();document.execCommand("copy");area.remove()}button.textContent="コピーしました";setTimeout(()=>button.textContent="計画案をコピー",1800)}
const CAUSAL_LAYER_DEFINITIONS=[
  {key:"background",label:"背景要因",description:"組織・体制・教育・会議体・ICT環境など、課題の背景にある構造的な要因です。"},
  {key:"direct",label:"直接原因",description:"現場の困りごとを直接生んでいる業務手順、ルール、役割分担、情報共有方法などです。"},
  {key:"field",label:"現場で起きている困りごと",description:"問題虫めがねで職員が実際に困っていると回答した内容です。"},
  {key:"risk",label:"影響・リスク",description:"その結果として起きている、または起きる可能性がある職員負担、残業、ミス、サービス品質低下、安全面のリスクです。"}
];
const CAUSAL_CONFIRMATION_COMPLETE="現時点では、問題虫めがねの回答から主要な課題構造を整理できています。管理者・活動推進リーダーには、因果関係図の妥当性確認を行ってください。";
const STRUCTURE_KEYWORDS=/人材|教育|体制|ルール|会議体|会議|ICT環境|ICT|管理|リーダー|定着|役割分担|標準化|情報共有|記録/;
const RISK_KEYWORDS=/負担|残業|確認漏れ|漏れ|ミス|サービス品質|品質|安全|離職|不安|ばらつき|偏り|時間がかか|遅れ|事故|休憩/;
let latestCausalStructure=null;
let latestCausalCopyText={layers:"",longTerm:"",questions:""};
function conciseNodeName(value,fallback){const clean=String(value||"").replace(/\s+/g," ").trim();return clean?(clean.length>52?clean.slice(0,51)+"…":clean):fallback}
function splitIssueItems(value){return String(value||"").split(/[\n、,，;；／]+/).map(item=>item.trim()).filter(item=>item.length>1)}
function structuralNodeName(text){
  if(/教育|人材育成|新人/.test(text))return"教育・人材育成体制が十分でない";
  if(/会議体|会議/.test(text))return"改善を継続する会議体が弱い";
  if(/ICT環境|ICT|システム|端末/.test(text))return"ICT活用の環境・運用が定着していない";
  if(/管理者|管理|リーダー/.test(text))return"管理者・リーダー層の推進体制が弱い";
  if(/役割分担|役割/.test(text))return"役割分担を見直す仕組みが弱い";
  if(/情報共有|申し送り/.test(text))return"情報共有を標準化する場やルールが弱い";
  if(/記録/.test(text))return"記録方法を標準化する場やルールが弱い";
  if(/ルール|標準化|定着|体制/.test(text))return"運用ルールを整え定着させる仕組みが弱い";
  return"";
}
function defaultRiskName(issue){const categories=(issue.problemCategories||[]).join(" ");if(categories.includes("記録")||categories.includes("連絡"))return"確認漏れや情報共有のばらつきが生じる";if(categories.includes("仕事の流れ"))return"職員負担や役割の偏りが続く";if(categories.includes("物を探す"))return"準備・移動時間と職員負担が増える";if(categories.includes("目標"))return"改善活動が定着しにくい";return"職員負担とサービス品質への影響が続く"}
function nodeAnswerDefinitions(node){return node.issues.some(issue=>issue.csvFormat==="new")?[["選んだ課題","selectedProblem"],["頻度","frequency"],["場面","timing"],["場所","location"],["困っていること","impact"],["継続期間","duration"]]:[["Q2","currentItems"],["Q3","current"],["Q5","gap"],["Q7","direction"]]}
function nodeAnswerLines(node){return nodeAnswerDefinitions(node).flatMap(([label,key])=>uniqueNodeValues(node,key).slice(0,2).map(value=>label+"："+value))}
function causalTextForIssue(issue){return issue.csvFormat==="new"?[issue.selectedProblem,issue.frequency,issue.timing,issue.location,issue.impact,issue.duration].join(" "):[issue.currentItems,issue.current,issue.gap,issue.direction].join(" ")}
function matchedNodeTerms(node,pattern){const text=node.issues.map(causalTextForIssue).join(" ");return[...new Set((text.match(pattern)||[]))]}
function nodeReasonText(node){
  if(node.issues.some(issue=>issue.csvFormat==="new")){
    if(node.layer==="background")return"新版CSVの選択課題・影響・継続期間から、背景にある要因の仮説として整理しました。CSVだけでは確定できないため、管理者・活動推進リーダーへの確認が必要です。";
    if(node.layer==="direct")return"新版CSVの選択課題と困っていることから、現場の困りごとを直接生んでいる可能性がある要因として整理しました。";
    if(node.layer==="field")return"新版CSVの選択課題・頻度・場面・場所から、現場で起きている困りごとの要点として整理しました。";
    return"新版CSVの困っていること欄を中心に、職員負担・確認漏れ・安全・品質などへの影響やリスクとして整理しました。";
  }
  if(node.layer==="background"){const terms=matchedNodeTerms(node,/人材|教育|体制|ルール|会議体|ICT環境|ICT|管理|リーダー|定着|役割分担|標準化|情報共有|記録/g);return"「"+node.name+"」に関連して"+(terms.length?"「"+terms.slice(0,4).join("」「")+"」":"体制・ルール")+"を示す回答があり、個別業務の背後にある構造的な要因として整理しました。"}
  if(node.layer==="direct"){const gaps=uniqueNodeValues(node,"gap"),directions=uniqueNodeValues(node,"direction");return"Q5のギャップ"+(gaps.length?"「"+gaps.slice(0,2).join("」「")+"」":"と現状の差")+"とQ7の改善方向"+(directions.length?"「"+directions.slice(0,2).join("」「")+"」":"")+"から、現場の困りごとを直接生む手順・ルール・役割上の要因として整理しました。"}
  if(node.layer==="field")return"Q2・Q3に「"+node.name+"」と同じ、または近い内容の回答が"+node.issues.length+"件あり、職員が実際に経験している困りごとの要点として整理しました。";
  const terms=matchedNodeTerms(node,/負担|残業|確認漏れ|漏れ|ミス|サービス品質|品質|安全|離職|不安|ばらつき|偏り|時間がかか|遅れ|事故/g);return(terms.length?"「"+terms.slice(0,4).join("」「")+"」に関する回答があり":"回答から職員負担やサービス品質への影響が考えられ")+"、困りごとの結果として起きている、または起きる可能性がある影響・リスクとして整理しました。";
}
function buildAdditionalConfirmation(issues){
  if(issues.some(issue=>issue.csvFormat==="new"))return{points:["ありたい姿が未確認です。","解決された状態が未確認です。","解決方向性が未確認です。","実施する取組が未確認です。","成果指標が未確認です。"],questions:["この課題について、どの状態になれば解決と言えますか。","関連事例を参考にする場合、どの取組が自施設で試せそうですか。","最初に試す範囲、担当者、期間はどうしますか。","成果指標は何を使って確認しますか。"],summary:""};
  const text=issues.map(issue=>[issue.currentItems,issue.current,issue.gap,issue.direction].join(" ")).join(" ");
  const checks=[{pattern:/朝|昼|夜|時間帯|勤務帯|送迎時|入浴時|食事時|休憩時/,point:"課題が特に起きやすい時間帯が未確認です。",question:"この課題は、どの時間帯に特に起きやすいですか"},{pattern:/場面|記録|申し送り|会議|人員配置|送迎|入浴|食事|排泄|訪問/,point:"課題が起きる具体的な業務場面が未確認です。",question:"この課題は、記録・申し送り・会議・人員配置のどれと関係が強いですか"},{pattern:/職種|介護職|看護職|ケアマネ|管理者|リーダー|新人|非常勤|夜勤者/,point:"負担が集中している職種・役割が未確認です。",question:"どの職種・役割に負担が偏っていますか"},{pattern:/試した|取り組んだ|導入した|改善した|見直した/,point:"既に試した改善策と、継続・定着しなかった理由が未確認です。",question:"これまでに同じ課題へ取り組んだことはありますか。うまくいかなかった場合、その理由は何ですか"},{pattern:/予算|人員|シフト|契約|設備|端末|制度上|制約/,point:"管理者側で把握している予算・人員・制度等の制約条件が未確認です。",question:"管理者側で把握している予算・人員・制度上の制約はありますか"},{pattern:/短期|中長期|今年度|来年度|3か月/,point:"短期改善と中長期改善のどちらで扱うかの判断が未確認です。",question:"この課題は短期改善で扱うべきですか、中長期改善で扱うべきですか"}];
  const missing=checks.filter(check=>!check.pattern.test(text));return{points:missing.map(check=>check.point),questions:missing.map(check=>check.question),summary:missing.length?"":CAUSAL_CONFIRMATION_COMPLETE};
}
function buildCausalStructure(issues){
  const buckets=Object.fromEntries(CAUSAL_LAYER_DEFINITIONS.map(layer=>[layer.key,new Map()]));
  function addNode(layer,name,issue,evidence){const safeName=conciseNodeName(name,layer==="risk"?defaultRiskName(issue):"未整理の課題");const key=normalized(safeName);if(!buckets[layer].has(key))buckets[layer].set(key,{layer,name:safeName,issues:[],evidence:new Set()});const node=buckets[layer].get(key);if(!node.issues.some(item=>item.id===issue.id))node.issues.push(issue);if(evidence)node.evidence.add(evidence)}
  issues.forEach(issue=>{
    if(issue.csvFormat==="new"){
      const background=issue.duration?"継続している背景要因の確認が必要（仮説）":"背景要因は追加確認が必要";
      addNode("background",background,issue,[issue.selectedProblem,issue.impact,issue.duration].filter(Boolean).join(" / "));
      addNode("direct",issue.impact||issue.selectedProblem||"直接原因の確認が必要",issue,issue.impact||issue.selectedProblem);
      addNode("field",issue.selectedProblem||issue.current||"現場で起きている困りごと",issue,issue.current);
      addNode("risk",RISK_KEYWORDS.test(issue.impact)?issue.impact:defaultRiskName(issue),issue,issue.impact);
      return;
    }
    const structuralText=[issue.gap,issue.direction,issue.current,issue.currentItems].join(" ");
    const backgroundName=STRUCTURE_KEYWORDS.test(structuralText)?structuralNodeName(structuralText):"";
    if(backgroundName)addNode("background",backgroundName,issue,issue.gap||issue.direction);else addNode("background","改善を支える体制・ルールの確認が必要",issue,issue.direction||issue.gap||issue.theme);
    if(issue.direction.includes("制度設計"))addNode("background","組織・制度として改善を支える体制が必要",issue,issue.direction);
    if(issue.gap)addNode("direct",issue.gap,issue,issue.gap);
    if(issue.direction){const directionCause=issue.direction.includes("制度設計")?"制度・体制の整備が必要":issue.direction+"の進め方が十分に整っていない";addNode("direct",directionCause,issue,issue.direction)}
    if(!issue.gap&&!issue.direction)addNode("direct","現状と目指す状態の差を具体化する必要",issue,issue.current||issue.theme);
    const fieldItems=splitIssueItems(issue.currentItems);fieldItems.forEach(item=>addNode("field",item,issue,issue.currentItems));
    if(issue.current&&!fieldItems.some(item=>normalized(issue.current).includes(normalized(item))))addNode("field",issue.current,issue,issue.current);
    if(!fieldItems.length&&!issue.current)addNode("field",issue.title||issue.theme+"の困りごと",issue,issue.gap||issue.theme);
    const riskSources=[issue.current,issue.currentItems,issue.gap].filter(Boolean);const matched=riskSources.filter(value=>RISK_KEYWORDS.test(value));
    if(matched.length)matched.forEach(value=>addNode("risk",value,issue,value));else addNode("risk",defaultRiskName(issue),issue,issue.current||issue.gap);
  });
  const layers={};CAUSAL_LAYER_DEFINITIONS.forEach(layer=>{layers[layer.key]=[...buckets[layer.key].values()].map(node=>({...node,evidence:[...node.evidence]})).sort((a,b)=>b.issues.length-a.issues.length||a.name.localeCompare(b.name,"ja")).slice(0,8)});
  const shortTerm=layers.field.filter(node=>node.issues.some(issue=>issue.csvFormat==="new"?findRelatedCases(issue,3).length>=3:/運用ルール|業務プロセス変更|ICT|道具/.test(issue.direction)&&findRelatedCases(issue,3).length>=3)).slice(0,5);
  const structuralTerms=/教育|人材|役割|情報共有|記録|会議|ICT|改善|管理|リーダー|体制|ルール|定着|確認/;
  const longTerm=[...layers.background,...layers.direct.filter(node=>structuralTerms.test(node.name))].filter((node,index,array)=>array.findIndex(other=>normalized(other.name)===normalized(node.name))===index).sort((a,b)=>b.issues.length-a.issues.length).slice(0,8);
  const additionalConfirmation=buildAdditionalConfirmation(issues);return{layers,shortTerm,longTerm,confirmationPoints:additionalConfirmation.points,interviewQuestions:additionalConfirmation.questions,confirmationSummary:additionalConfirmation.summary};
}
function uniqueNodeValues(node,key){return[...new Set(node.issues.map(issue=>issue[key]).filter(Boolean))]}
function appendList(target,items,emptyText){target.replaceChildren();(items.length?items:[emptyText]).forEach(item=>{const li=document.createElement("li");li.textContent=item;target.append(li)})}
function renderCausalNode(node,layerLabel){
  const card=document.createElement("article");card.className="causal-node";
  const kind=document.createElement("span");kind.className="node-kind";kind.textContent="分類："+layerLabel;
  const pointLabel=document.createElement("span");pointLabel.className="node-point-label";pointLabel.textContent="要点";
  const title=document.createElement("h5");title.textContent=node.name;
  const roles=uniqueNodeValues(node,"role"),themes=uniqueNodeValues(node,"theme");
  const count=document.createElement("p");count.className="node-meta";count.textContent="該当カード件数："+node.issues.length+"件";
  const reason=document.createElement("p");reason.className="node-reason";const reasonLabel=document.createElement("strong");reasonLabel.textContent="この要点に整理した理由：";reason.append(reasonLabel,document.createTextNode(nodeReasonText(node)));
  const answers=document.createElement("div");answers.className="node-answers";const answersLabel=document.createElement("strong");answersLabel.textContent="該当する回答";const answerList=document.createElement("ul");(nodeAnswerLines(node).length?nodeAnswerLines(node):["該当回答は未入力です。"]).forEach(value=>{const li=document.createElement("li");li.textContent=value;answerList.append(li)});answers.append(answersLabel,answerList);
  const respondents=document.createElement("p");respondents.className="node-meta";respondents.textContent="回答者の立場："+(roles.join("、")||"未入力");
  const themesText=document.createElement("p");themesText.className="node-meta";themesText.textContent="関連テーマ："+(themes.join("、")||"未入力");
  const button=document.createElement("button");button.type="button";button.className="evidence-button";button.textContent="該当回答を見る";button.addEventListener("click",()=>openCausalEvidence(node,layerLabel));
  card.append(kind,pointLabel,title,count,reason,answers,respondents,themesText,button);return card;
}
function evidenceFields(issue){return issue.csvFormat==="new"?[["サービス種別",issue.service],["回答者の立場",issue.role],["困りごと分類",issue.problemCategory],["選んだ課題",issue.selectedProblem],["頻度",issue.frequency],["場面",issue.timing],["場所",issue.location],["困っていること",issue.impact],["継続期間",issue.duration]]:[["回答者の立場",issue.role],["テーマ",issue.theme],["Q2の困りごと",issue.currentItems],["Q3の現状",issue.current],["Q5のギャップ",issue.gap],["Q7の方向性",issue.direction]]}
function openCausalEvidence(node,layerLabel){
  const content=document.querySelector("#causal-evidence-content");content.replaceChildren();
  const title=document.createElement("h2");title.id="evidence-dialog-title";title.textContent=node.name;
  const intro=document.createElement("p");intro.className="dialog-service";intro.textContent=layerLabel+" / 該当カード "+node.issues.length+"件";const reason=document.createElement("p");reason.className="node-reason";reason.textContent="この要点に整理した理由："+nodeReasonText(node);
  content.append(title,intro,reason);
  node.issues.forEach(issue=>{const record=document.createElement("section");record.className="evidence-record";const heading=document.createElement("h3");heading.textContent=issue.office||issue.selectedProblem||"回答"+issue.id;record.append(heading);evidenceFields(issue).forEach(([label,value])=>{const p=document.createElement("p");const strong=document.createElement("strong");strong.textContent=label+"：";p.append(strong,document.createTextNode(value||"未入力"));record.append(p)});content.append(record)});
  document.querySelector("#causal-evidence-dialog").showModal();
}
function causalLayerText(structure){return CAUSAL_LAYER_DEFINITIONS.map(layer=>"【"+layer.label+"】\n"+structure.layers[layer.key].map(node=>{const roles=uniqueNodeValues(node,"role").join("、")||"未入力",themes=uniqueNodeValues(node,"theme").join("、")||"未入力";return"要点："+node.name+"\n分類："+layer.label+"\n該当カード件数："+node.issues.length+"件\nこの要点に整理した理由："+nodeReasonText(node)+"\n該当する回答：\n"+nodeAnswerLines(node).map(value=>"・"+value).join("\n")+"\n回答者の立場："+roles+"\n関連テーマ："+themes}).join("\n\n")).join("\n\n")}
function setCopyButtonMessage(button,message,defaultLabel){button.textContent=message;setTimeout(()=>button.textContent=defaultLabel,2200)}
function copyTextContent(text,button,defaultLabel){const value=String(text||"").trim();if(!value){setCopyButtonMessage(button,"コピーする内容がありません",defaultLabel);return}const done=()=>setCopyButtonMessage(button,"コピーしました",defaultLabel);const failed=()=>setCopyButtonMessage(button,"コピーできませんでした",defaultLabel);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(value).then(done).catch(()=>fallbackCopyText(value,done,failed));else fallbackCopyText(value,done,failed)}
function fallbackCopyText(text,done,failed){const area=document.createElement("textarea");area.value=text;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.append(area);area.select();let copied=false;try{copied=document.execCommand("copy")}catch(error){copied=false}area.remove();copied?done():failed()}
function renderCausalStructure(issues){
  const section=document.querySelector("#causal-draft");section.removeAttribute("hidden");section.hidden=false;section.style.removeProperty("display");
  latestCausalStructure=buildCausalStructure(issues);
  const layers=document.querySelector("#causal-layers");layers.replaceChildren();
  CAUSAL_LAYER_DEFINITIONS.forEach((definition,index)=>{const column=document.createElement("section");column.className="causal-layer";const head=document.createElement("div");head.className="causal-layer-head";const step=document.createElement("span");step.textContent="LAYER "+(index+1);const title=document.createElement("h4");title.textContent=definition.label;const desc=document.createElement("span");desc.textContent=definition.description;head.append(step,title,desc);const list=document.createElement("div");list.className="causal-node-list";latestCausalStructure.layers[definition.key].forEach(node=>list.append(renderCausalNode(node,definition.label)));if(!list.children.length){const empty=document.createElement("p");empty.className="node-meta";empty.textContent="該当する内容はまだ抽出されていません。管理者・活動推進リーダーへの確認時に補足してください。";list.append(empty)}column.append(head,list);layers.append(column)});
  appendList(document.querySelector("#short-term-issues"),latestCausalStructure.shortTerm.map(node=>node.name+"（"+node.issues.length+"件）: 関連事例を参考候補として確認し、3か月以内の小さな試行を検討"),"短期改善候補は、管理者との確認後に整理してください。");
  appendList(document.querySelector("#long-term-issues"),latestCausalStructure.longTerm.map(node=>node.name+"（"+node.issues.length+"件）"),"中長期課題候補は、管理者との確認後に整理してください。");
  appendList(document.querySelector("#confirmation-points"),latestCausalStructure.confirmationPoints,latestCausalStructure.confirmationSummary);
  appendList(document.querySelector("#interview-questions"),latestCausalStructure.interviewQuestions,latestCausalStructure.confirmationSummary);
  const questionItems=latestCausalStructure.interviewQuestions.length?latestCausalStructure.interviewQuestions:[latestCausalStructure.confirmationSummary];latestCausalCopyText={layers:causalLayerText(latestCausalStructure),longTerm:latestCausalStructure.longTerm.length?"【中長期課題候補】\n"+latestCausalStructure.longTerm.map(node=>"・"+node.name+"（該当カード "+node.issues.length+"件）").join("\n"):"",questions:"【追加確認が必要な場合の質問】\n"+questionItems.map(item=>"・"+item).join("\n")};
}
document.querySelector("#evidence-dialog-close").addEventListener("click",()=>document.querySelector("#causal-evidence-dialog").close());
document.querySelector("#causal-evidence-dialog").addEventListener("click",event=>{if(event.target===event.currentTarget)event.currentTarget.close()});
document.querySelector("#copy-causal-layers").addEventListener("click",event=>copyTextContent(latestCausalCopyText.layers,event.currentTarget,"4層整理をコピー"));
document.querySelector("#copy-long-term").addEventListener("click",event=>copyTextContent(latestCausalCopyText.longTerm,event.currentTarget,"中長期課題候補をコピー"));
document.querySelector("#copy-interview-questions").addEventListener("click",event=>copyTextContent(latestCausalCopyText.questions,event.currentTarget,"追加確認質問をコピー"));
function selectPlannerTab(name){document.querySelectorAll(".planner-tab").forEach(b=>{const active=b.dataset.plannerTab===name;b.classList.toggle("is-active",active);b.setAttribute("aria-selected",String(active))});["csv","manual","case"].forEach(key=>document.querySelector("#planner-"+key+"-panel").hidden=key!==name)}
function createPlanFromCase(item){selectPlannerTab("case");document.querySelector("#selected-case-message").textContent="選択中："+item.title;renderPlan({...item,planSource:"case",problemCategories:[item.problemCategory],categories:item.categories||[]});document.querySelector("#planner").scrollIntoView({behavior:"smooth",block:"start"})}
function renderCsvSummary(rows,issues,format){
  const services=[...new Set(issues.map(x=>x.service).filter(Boolean))],roles=[...new Set(issues.map(x=>x.role).filter(Boolean))],themeCounts={};issues.forEach(x=>themeCounts[x.theme]=(themeCounts[x.theme]||0)+1);
  const cards=[["読込形式",format.label],["回答件数",rows.length+"件"],["課題カード件数",issues.length+"件"],["サービス種別",services.join("、")||"未入力"],["回答者の立場",roles.join("、")||"未入力"]];
  if(format.type==="old"){const offices=[...new Set(issues.map(x=>x.office).filter(Boolean))];cards.splice(3,0,["事業所",offices.join("、")||"未入力"])}
  const summary=document.querySelector("#csv-summary");summary.hidden=false;summary.replaceChildren(...cards.map(([h,v])=>{const c=document.createElement("div");c.className="summary-card";const strong=document.createElement("strong");strong.textContent=h;const p=document.createElement("p");p.textContent=v;c.append(strong,p);return c}));
  const themes=document.createElement("div");themes.className="summary-card";themes.style.gridColumn="1/-1";const s=document.createElement("span");s.textContent="困りごと分類別集計";const p=document.createElement("p");p.textContent=Object.entries(themeCounts).map(([k,v])=>k+" "+v+"件").join(" / ")||"未入力";themes.append(s,p);summary.append(themes);
  if(format.type==="new"){const notice=document.createElement("div");notice.className="summary-card";notice.style.gridColumn="1/-1";const ns=document.createElement("span");ns.textContent="注意書き";const np=document.createElement("p");np.textContent=NEW_CSV_NOTICE;notice.append(ns,np);summary.append(notice)}
}
function renderCausalDraftSection(issues){const issueList=document.querySelector("#csv-issue-list");const section=document.querySelector("#causal-draft");if(!issueList||!section)return;issueList.insertAdjacentElement("afterend",section);section.removeAttribute("hidden");section.hidden=false;section.style.removeProperty("display");section.dataset.rendered="true";renderCausalStructure(issues)}
function issueCardFields(issue){return issue.csvFormat==="new"?[["サービス種別",issue.service],["回答者の立場",issue.role],["困りごと分類",issue.problemCategory],["今の困りごと",issue.currentItems],["現状の一言",issue.current],["ありたい姿",issue.desired],["一番大きいギャップ",issue.gap],["解決された状態",issue.resolved],["解決方向性",issue.direction],["実施する取組",issue.action],["成果指標",issue.metric]]:[["今の困りごと",issue.currentItems],["現状の一言",issue.current],["ありたい姿",issue.desired],["一番大きいギャップ",issue.gap],["解決された状態",issue.resolved],["解決方向性",issue.direction]]}
function issueMetaParts(issue){return issue.csvFormat==="new"?[issue.service,issue.role,issue.theme]:[issue.office,issue.service,issue.theme]}
function renderIssueCards(issues){
  const list=document.querySelector("#csv-issue-list");list.replaceChildren(...issues.map(issue=>{const card=document.createElement("article");card.className="issue-card";card.innerHTML='<div class="issue-card-head"><h4></h4><span class="priority-score"></span></div><p class="issue-meta"></p><div class="issue-grid"></div>';card.querySelector("h4").textContent=issue.title;card.querySelector(".priority-score").textContent="優先度 "+issue.priorityScore;card.querySelector(".issue-meta").textContent=issueMetaParts(issue).filter(Boolean).join(" / ");const grid=card.querySelector(".issue-grid");issueCardFields(issue).forEach(([h,v])=>{const p=document.createElement("p");const strong=document.createElement("strong");strong.textContent=h+"：";p.append(strong,document.createTextNode(v||"未入力"));grid.append(p)});const button=document.createElement("button");button.type="button";button.className="issue-plan-button";button.textContent=issue.csvFormat==="new"?"追加確認が必要な計画案を作る":"この課題の計画案を作る";button.addEventListener("click",()=>renderPlan(issue));card.append(button);return card}));
  renderCausalDraftSection(issues);
}
document.querySelectorAll(".planner-tab").forEach(button=>button.addEventListener("click",()=>selectPlannerTab(button.dataset.plannerTab)));
PROBLEM_CATEGORIES.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=value;document.querySelector('#manual-plan-form select[name="problemCategory"]').append(option)});
document.querySelector("#problem-csv-input").addEventListener("change",event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const rows=parseCSV(String(reader.result));if(!rows.length)throw new Error();const format=detectCsvFormat(rows);if(format.type==="unknown")throw new Error();csvIssues=calculateCsvIssues(rows,format);if(!csvIssues.length)throw new Error();document.querySelector("#csv-status").textContent="読込形式："+format.label+"。回答件数："+rows.length+"件。課題カード件数："+csvIssues.length+"件。";renderCsvSummary(rows,csvIssues,format);renderIssueCards(csvIssues);document.querySelector("#csv-status").textContent+=" 因果関係図のたたき台を表示しました。"}catch(error){document.querySelector("#csv-status").textContent="CSVを読み取れませんでした。見出しと文字コード（UTF-8）を確認してください。"}};reader.readAsText(file,"UTF-8")});
document.querySelector("#manual-plan-form").addEventListener("submit",event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));renderPlan({title:values.title,current:values.current,desired:values.desired,problemCategories:[values.problemCategory],categories:mapByIncludes(values.direction,DIRECTION_CATEGORY_MAP),direction:values.direction,service:values.service,keywords:values.keywords,priorityReason:"手入力された課題をもとに、分類・方向性・キーワードが近い事例を優先"})});
loadCases();
