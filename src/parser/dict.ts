import { splitKV } from "../utils";
import * as _ from "lodash";

export class SurgeDict {
    name: string;
    value: string;
    private _array: Array<string>;
    private _dict: _.Dictionary<string>;

    constructor(entry: string) {
        [this.name, this.value] = splitKV(entry);
        this._array = _(this.value).split(/\s*\,\s*/).filter((s) => s.indexOf("=") === -1).value();
        this._dict = _(this.value).split(/\s*\,\s*/).filter((s) => s.indexOf("=") > 0).map((s) => {
            return splitKV(s);
        }).fromPairs().value();
    }

    hasKey(key: string): Boolean {
        return this._dict.hasOwnProperty(key);
    }

    getKey(key: string | number): string {
        if (typeof(key) === "string") {
            return this._dict[key];
        } else if (typeof key === "number") {
            return this._array[key];
        } else {
            // runtime assertion
            throw new Error("invalid key type");
        }
    }
}