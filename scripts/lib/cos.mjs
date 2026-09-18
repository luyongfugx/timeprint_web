import COS from "cos-nodejs-sdk-v5";

export function cosLocation() {
  const Bucket = process.env.TEMPLATE_COS_BUCKET ?? "wm-1330977225";
  const Region = process.env.TEMPLATE_COS_REGION ?? "ap-singapore";
  const Prefix = process.env.TEMPLATE_COS_PREFIX ?? "template-assets-v2";
  if (!/^[a-z0-9-]+-\d+$/.test(Bucket) || !/^[a-z]+-[a-z]+(?:-\d+)?$/.test(Region) || !/^[a-zA-Z0-9_-]+$/.test(Prefix))
    throw new Error("Configure a valid COS bucket, region and prefix.");
  return { Bucket, Region, Prefix };
}
export function cosConfig() {
  const { Bucket, Region, Prefix } = cosLocation();
  const SecretId = process.env.TEMPLATE_COS_SECRET_ID;
  const SecretKey = process.env.TEMPLATE_COS_SECRET_KEY;
  if (!SecretId || !SecretKey) throw new Error("Configure TEMPLATE_COS_SECRET_ID / TEMPLATE_COS_SECRET_KEY.");
  return { Bucket, Region, Prefix, SecretId, SecretKey };
}
export function cosConfigured() {
  try {
    cosConfig();
    return true;
  } catch {
    return false;
  }
}
export function createCOS() {
  const { SecretId, SecretKey } = cosConfig();
  return new COS({ SecretId, SecretKey, Protocol: "https:", Timeout: 15000 });
}
export function objectKey(key) {
  if (!/^(staging|sealed)\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key)) throw new Error("Invalid template object key");
  return `${cosLocation().Prefix}/${key}`;
}
export function objectUploadHeaders(contentType) {
  return { "Content-Type": contentType, "x-cos-forbid-overwrite": "true" };
}
export async function signedObjectURL(key, method, headers = {}, expires = 300) {
  const { Bucket, Region } = cosConfig();
  return new Promise((resolve, reject) => {
    createCOS().getObjectUrl(
      {
        Bucket,
        Region,
        Key: objectKey(key),
        Method: method,
        Sign: true,
        Protocol: "https:",
        Expires: expires,
        Headers: headers,
      },
      (error, data) => {
        if (error) reject(new Error("Could not sign COS object request"));
        else resolve(data.Url);
      },
    );
  });
}
