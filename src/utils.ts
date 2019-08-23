import * as rp from "request-promise-native";
import { promises as fsPromises } from "fs";
import * as bs58 from "bs58";

const options = {
    headers: {
      "User-Agent": "Zuccina 1.0.1 / Request 2.88.0"
    }
};

function download(url: string): Promise<string> {
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return rp.get(url, options).promise().catch((ex) => {
            console.log(url);
            console.log(ex);
            return Promise.resolve("");
        });
    } else {
        // do explicit type conversion here.
        // with `encoding` option, `Buffer` will be converted into `string`.
        return <Promise<string>>fsPromises.readFile(url, {encoding: "utf-8"});
    }
}

function splitKV(input: string): [string, string] {
    const idx = input.indexOf("=");
    return [input.substring(0, idx).trim(), input.substring(idx + 1, input.length).trim()];
}

function base58Encode(input: string, encoding: BufferEncoding = "utf-8"): string {
    const bytes = Buffer.from(input, encoding);
    return bs58.encode(bytes);
}

function base58Decode(input: string): string {
    const bytes = bs58.decode(input);
    return bytes.toString();
}

export {download, splitKV, base58Decode, base58Encode};