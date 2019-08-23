import * as utils from "./src/utils";
import { SurgeTemplate } from "./src/parser/template";

(async function() {
    const config = await utils.download(utils.base58Decode(utils.base58Encode("/Users/megrez/Code/opensource/zucchina/EU_TMPL.conf")));
    const template = new SurgeTemplate(config, `https://example.com/${utils.base58Encode("/Users/megrez/downloads/ITALY.conf")}?d=DE`);
    template.parse();
    await template.expand();
    // console.log(template.parser.config)
    const result = await template.render();
    console.log(result);
})();
