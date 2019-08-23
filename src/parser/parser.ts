///<reference path='../../node_modules/immutable/dist/Immutable.d.ts'/>
import { Entry, KVEntry as GeneralEntry, ProxyGroupEntry, RuleSetEntry, RuleEntry, ProxyEntry, URLRewriteEntry, HeaderRewriteEntry } from "./entry";
import * as _ from "lodash";
import { splitKV } from "../utils";
import { Map, List } from "immutable";

const MANAGED_CONFIG_PREFIX = "#!MANAGED-CONFIG";
// Just keep `Replica` now
export enum SECTION_HEADER {
    PROXY = "Proxy",
    GENERAL = "General",
    REPLICA = "Replica",
    PROXY_GROUP = "Proxy Group",
    RULE = "Rule",
    URL_REWRITE = "URL Rewrite",
    HEADER_REWRITE = "Header Rewrite",
    HOST = "Host"
}

export class ConfigParser {

    private content: Array<string>;
    managed_url: string;
    interval: number;
    strict: Boolean;
    private _config: Map<SECTION_HEADER, List<Entry>>;

    constructor(content: string) {
        this.content = content.split(/\n+/);
        this.managed_url = undefined;
        this.interval = 86400;
        this.strict = false;
        this._config = Map();
    }

    get config(): Map<SECTION_HEADER, List<Entry>> {
        return this._config;
    }

    set config(config: Map<SECTION_HEADER, List<Entry>>) {
        this._config = config;
    }

    parse(): void {
        if (this.content[0].startsWith(MANAGED_CONFIG_PREFIX)) {
            this.__parse_header();
        } else {
            console.debug("Unmanaged config");
        }
        this.__parse_sections();
    }

    /**
     * The config can only be updated when Surge main application is running.
     * Note: The new config in remote should also contain #!MANAGED-CONFIG line. Otherwise the config will become a regular one.
     * @reference: https://manual.nssurge.com/others/managed-configuration.html
     */
    private __parse_header(): void {
        const line = this.content[0];
        const [_, url, updateInterval, strictMode] = line.trim().split(/\s+/, 4);
        this.managed_url = url;
        if (updateInterval !== undefined) {
            this.interval = parseInt(updateInterval.split("=")[1]);
        }

        if (strictMode !== undefined) {
            this.strict = strictMode.split("=")[1].toLowerCase() === "true" ? true : false;
        }
        console.debug(`Config Managed thru ${this.managed_url} interval=${this.interval} strict=${this.strict}`);
    }

    private __is_comment(line: string): Boolean {
        return line.startsWith("#") || line.startsWith(";") || line.startsWith("//");
    }

    private __parse_sections(): void {
        let CUR_SECTION: SECTION_HEADER = undefined;
        for (let line of this.content) {
            if (line.trim() === "") {
                continue;
            }
            line = line.trim();
            // According to the syntax define here:
            // https://manual.nssurge.com/overview/configuration.html#Comment
            if (this.__is_comment(line)) {
                continue;
            }
            if (line.startsWith("[") && line.endsWith("]")) {
                CUR_SECTION = <SECTION_HEADER>line.substring(1, line.length - 1);
                this.config = this.config.set(CUR_SECTION, List());
            } else if (CUR_SECTION !== undefined) {
                const entry = this.__parse_entry(line, CUR_SECTION);
                if (entry != undefined && entry.isValid()) {
                    this.config = this.config.set(CUR_SECTION, this.config.get(CUR_SECTION).push(entry));
                }
            } else {
                continue;
            }
        }
    }

    async expand(): Promise<void> {
        // rules
        await this.__expand_rules();
        // proxies
        await this.__expand_proxies();
    }

    private async __expand_rules(): Promise<void> {
        const new_rules: Array<RuleEntry> = [];
        for (const rule of this.config.get(SECTION_HEADER.RULE, List()).toArray()) {
            if (rule instanceof RuleSetEntry) {
                const real_rules = await rule.generateEntries();
                _(real_rules).filter((line) => !this.__is_comment(line) && line.trim() !== "").forEach((line) => new_rules.push(new RuleEntry(line, rule.direction)));
            } else {
                new_rules.push(rule);
            }
        }
        this.config = this.config.set(SECTION_HEADER.RULE, List(new_rules));
    }

    private async __expand_proxies(): Promise<void> {
        let new_proxies: Map<string, ProxyEntry> = Map();
        // Add existed `Proxy` to dict
        this.config.get(SECTION_HEADER.PROXY, List()).forEach((proxy: ProxyEntry) => {
            new_proxies = new_proxies.set(proxy.name, proxy);
        });

        await Promise.all(this.config.get(SECTION_HEADER.PROXY_GROUP, List()).toArray().map(async (group: ProxyGroupEntry) => {
            if (group.hasExternalResource()) {
                const proxies = await group.generateEntries();
                const proxy_names = [];
                _(proxies).filter((line) => !this.__is_comment(line) && line !== "").forEach((line) => {
                    const [name, proxy_detail] = splitKV(line);
                    proxy_names.push(name);
                    new_proxies = new_proxies.set(name, new ProxyEntry(name, proxy_detail));
                });
                // replace proxy
                group.external = false;
                for (const name of proxy_names) {
                    group.proxy = name;
                }
            }
        }));

        this.config = this.config.set(SECTION_HEADER.PROXY, new_proxies.toList());

    }

    private __parse_entry(entry: string, section: SECTION_HEADER): Entry {
        if (section === SECTION_HEADER.GENERAL || section === SECTION_HEADER.REPLICA || section === SECTION_HEADER.HOST) {
            return new GeneralEntry(entry);
        } else if (section === SECTION_HEADER.PROXY_GROUP) {
            return new ProxyGroupEntry(entry);
        } else if (section === SECTION_HEADER.RULE) {
            if (entry.startsWith("RULE-SET")) {
                return new RuleSetEntry(entry);
            } else {
                return new RuleEntry(entry);
            }
        } else if (section === SECTION_HEADER.URL_REWRITE) {
            return new URLRewriteEntry(entry);
        } else if (section === SECTION_HEADER.HEADER_REWRITE) {
            return new HeaderRewriteEntry(entry);
        } else {
            console.log("invalid section name");
        }
        return undefined;
    }
}