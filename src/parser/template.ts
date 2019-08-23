import { ConfigParser, SECTION_HEADER } from "./parser";
import { Entry } from "./entry";
import { List } from "immutable";

export class SurgeTemplate {
    parser: ConfigParser;
    private url: string;

    constructor(template: string, url: string) {
        this.parser = new ConfigParser(template);
        this.url = url;
    }

    parse(): void {
        this.parser.parse();
    }

    async expand(): Promise<void> {
        await this.parser.expand();
    }

    async render(): Promise<string> {
        let content = "";
        // first write auto managed info
        content = this.__write_content(content, `#!MANAGED-CONFIG ${this.url} interval=${this.parser.interval} strict=${this.parser.strict}\n`);
        // write [General]
        for (const header of [SECTION_HEADER.GENERAL, SECTION_HEADER.PROXY, SECTION_HEADER.PROXY_GROUP, SECTION_HEADER.RULE, SECTION_HEADER.URL_REWRITE, SECTION_HEADER.HEADER_REWRITE]) {
            content = this.__write_content(content, `[${header}]\n`);
            this.parser.config.get(header, List<Entry>()).forEach((entry) => {
                content = this.__write_content(content, entry);
            });
            content = this.__write_content(content, "\n");
        }
        return content;
    }

    __write_content(content: string, entry: string | Entry): string {
        return content + `${entry}\n`;
    }
}