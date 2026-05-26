import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = "us-east-2";
const BUCKET = "mesi-files-prod";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_KEY,
  },
});

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

export const uploadFileToS3 = async ({
  empresa,
  modulo,
  submodulo,
  año,
  mes,
  file,
}) => {
  const fileName = `${Date.now()}_${file.name}`;

  const key = submodulo
    ? `${slugify(empresa)}/${slugify(modulo)}/${slugify(submodulo)}/${año}/${mes}/${fileName}`
    : `${slugify(empresa)}/${slugify(modulo)}/${año}/${mes}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: file.type,
  });

  await s3.send(command);

  return {
    key,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
  };
};