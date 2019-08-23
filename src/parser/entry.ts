import { splitKV, download } from "../utils";
import { SurgeDict } from "./dict";

enum BuiltInPolicy {
    DIRECT = "DIRECT",
    REJECT = "REJECT"
}

export enum ProxyGroupMode {
    URL_TEST = "url-test",
    FALLBACK = "fallback",
    SELECT = "select",
    SSID = "ssid"
}

enum RuleMatcher {
    IP_CIDR = "IP-CIDR",
    GEO_IP = "GEO-IP",
    DOMAIN = "DOMAIN",
    DOMAIN_SUFFIX = "DOMAIN-SUFFIX",
    DOMAIN_KEYWORD = "DOMAIN-KEYWORD",
    USER_AGENT = "USER-AGENT",
    URL_REGEX = "URL-REGEX",
    PROCESS_NAME = "PROCESS-NAME",
    AND = "AND",
    OR = "OR",
    NOT = "NOT",
    DEST_PORT = "DEST-PORT",
    SRC_IP = "SRC-IP",
    IN_PORT = "IN-PORT",
    RULE_SET = "RULE-SET",
    FINAL = "FINAL"
}

enum URLRewriteType {
    HEADER = "header",
    HTTP302 = "302",
    REJECT = "reject"
}

enum HeaderRewriteActionType {
    HEADER_ADD = "header-add",
    HEADER_DEL = "header-del",
    HEADER_REPALCE = "header-replace"
}

export class Entry {
    raw_entry: string;
    valid: Boolean;

    constructor(entry: string) {
        this.raw_entry = entry;
        this.valid = true;
    }

    toString(): string {
        return this.raw_entry;
    }

    isValid(): Boolean {
        return this.valid;
    }
}

export class KVEntry extends Entry {
    key: string;
    value: string;
    dict: SurgeDict;
    // nothing to do now
    // KV type
    constructor(entry: string) {
        super(entry);
        [this.key, this.value] = splitKV(this.raw_entry);
        this.dict = new SurgeDict(entry);
    }
}

export class ProxyGroupEntry extends Entry {
    dict: SurgeDict;
    proxies: Array<string>;
    external: Boolean;
    name: string;
    mode: ProxyGroupMode;
    test_url: string;
    policy_path: string;

    constructor(entry: string) {
        super(entry);
        this.dict = new SurgeDict(entry);
        this.proxies = [];
        this.external = false;
        const entries = this.raw_entry.split(/\s*,\s*/);
        // name and modex
        [this.name, this.mode] = [this.dict.name, <ProxyGroupMode>this.dict.getKey(0)];
        if (this.mode == ProxyGroupMode.URL_TEST || this.mode == ProxyGroupMode.FALLBACK) {
            // `url` parameter is required
            // @ref: https://manual.nssurge.com/policy/group.html
            this.test_url = splitKV(entries[entries.length - 1])[1];
            // TODO: support other optional parameters
            if (!this.__parse_external_group(entries[1])) {
                for (let i = 1; i < entries.length - 1; i++) {
                    this.proxy = entries[i];
                }
            }
        } else if (this.mode == ProxyGroupMode.SELECT) {
            if (!this.__parse_external_group(entries[1])) {
                for (let i = 1; i < entries.length; i++) {
                    this.proxy = entries[i];
                }
            }
        } else if (this.mode == ProxyGroupMode.SSID) {
            // TODO: support `SSID`
        } else {
            this.valid = false;
        }
    }

    set proxy(proxy: string) {
        this.proxies.push(proxy);
    }

    /**
     *
     * @param {String} entry
     * @returns {Boolean} True if has external resource, otherwise False
     */
    __parse_external_group(entry: string): Boolean {
        if (entry.startsWith("policy-path")) {
            this.external = true;
            this.policy_path = splitKV(entry)[1];
            return true;
        }
        return false;
    }

    hasExternalResource(): Boolean {
        return this.external;
    }

    async generateEntries(): Promise<Array<string>> {
        const contents = await download(this.policy_path);
        return contents.split(/\n+/);
    }

    toString(): string {
        let line = `${this.name} = ${this.mode}, ${this.proxies.join(",")}`;
        if (this.dict.hasKey("url")) {
            line += `, url = ${this.dict.getKey("url")}`;
        }
        return line;
    }
}

export class RuleEntry extends Entry {
    direction: string;
    matcher: RuleMatcher;
    rule: string;

    constructor(entry: string, direction?: string) {
        super(entry);
        const entries = entry.split(/\s*\,\s*/);
        this.direction = direction || entries[entries.length - 1];
        this.matcher = <RuleMatcher>entries[0];
        this.__check_rule(entries);
    }

    __check_rule(entries: Array<string>) {
        if (this.matcher !== RuleMatcher.RULE_SET && this.matcher !== RuleMatcher.FINAL) {
            // TODO: use SurgeDict
            this.rule = entries[1];
        }
    }

    toString(): string {
        if (this.matcher !== RuleMatcher.FINAL) {
            return `${this.matcher},${this.rule},${this.direction}`;
        } else {
            return `${this.matcher},${this.direction}`;
        }
    }
}

export class RuleSetEntry extends RuleEntry {
    ruleset_url: string;

    constructor(entry: string) {
        super(entry);
        this.ruleset_url = entry.split(/\s*\,\s*/)[1];
    }

    async generateEntries(): Promise<Array<string>> {
        const contents = await download(this.ruleset_url);
        return contents.split(/\n+/);
    }
}

export class ProxyEntry extends Entry {
    name: string;
    dict: SurgeDict;

    constructor(name, entry) {
        super(entry);
        this.name = name;
        this.dict = new SurgeDict(`${this.name} = ${this.raw_entry}`);
    }

    toString() {
        // TODO: Add test-url
        return `${this.name} = ${this.raw_entry}`;
    }
}

export class URLRewriteEntry extends Entry {
    regexp: string;
    replacement: string;
    type: URLRewriteType;

    constructor(entry: string) {
        super(entry);
        let type: string;
        [this.regexp, this.replacement, type] = entry.split(/\s+/, 3);
        this.type = URLRewriteType[type];
    }
}

export class HeaderRewriteEntry extends Entry {
    regexp: string;
    action_type: HeaderRewriteActionType;
    header_field: string;
    new_val: string;

    constructor(entry: string) {
        super(entry);
        let action_type: string;
        [this.regexp, action_type, this.header_field, this.new_val] = entry.split(/\s+/, 4);
        this.action_type = HeaderRewriteActionType[action_type];
    }
}