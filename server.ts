import * as Koa from "koa";
import * as Router from "koa-router";
import * as utils from "./src/utils";
import { SurgeTemplate } from "./src/parser/template";

const app = new Koa();
const router = new Router();

router.get("/:file", async (ctx) => {
    const file = ctx.params.file;
    const ori_url = utils.base58Decode(file);
    const config = await utils.download(ori_url);
    const country = ctx.query.c || ctx.header["country-code"] || "IT";
    console.log(`Request from country ${country}`);
    const template = new SurgeTemplate(config, `https://s.coder.dog/${file}`);
    template.parse();
    await template.expand();
    // console.log(template.parser.config)
    const result = await template.render();

    ctx.body = result;
});

app
.use(router.routes())
.use(router.allowedMethods());


app.listen(3000);