const crypto = require("crypto");

const defaultKey = "a3K8Bx%2r8Y7#xDh";
const defaultKeyV2 = "{yxAHAY_Lm6pbC/<";
const iv_v2 = Buffer.from([
    0x54, 0x40, 0x78, 0x44, 0x49, 0x67, 0x5a, 0x51, 0x6c, 0x5e, 0x63, 0x13,
]);
const aad_v2 = Buffer.from("qualcomm-test");

function encrypt(data, key = defaultKey) {
    const cipher = crypto.createCipheriv("aes-128-ecb", key, "");
    const str = cipher.update(JSON.stringify(data), "utf8", "base64");
    const request = str + cipher.final("base64");
    return request;
}

function encryptV2(data, key = defaultKeyV2) {
    const str = JSON.stringify(data);
    const cipher = crypto
        .createCipheriv("aes-128-gcm", key, iv_v2)
        .setAAD(aad_v2);
    const pack = cipher.update(str, "utf8", "base64") + cipher.final("base64");
    const tag = cipher.getAuthTag().toString("base64");
    return { pack, tag };
}

function decrypt(data, key = defaultKey) {
    const decipher = crypto.createDecipheriv("aes-128-ecb", key, "");
    const str = decipher.update(data, "base64", "utf8");
    const response = JSON.parse(str + decipher.final("utf8"));

    return response;
}

function decryptV2(data, tag, key = defaultKeyV2) {
    const tagbuffer = Buffer.from(tag, "base64");
    const decipher = crypto.createDecipheriv("aes-128-gcm", key, iv_v2)
        .setAuthTag(tagbuffer)
        .setAAD(aad_v2);
    const str = decipher.update(data, "base64", "utf8");
    const response = JSON.parse(str + decipher.final("utf8"));
    
    return response;    
}

module.exports = {
    defaultKey,
    encrypt,
    decrypt,
    encryptV2,
    decryptV2,
    defaultKeyV2,
};
