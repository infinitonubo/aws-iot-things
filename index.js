const AWS = require('aws-sdk');

async function main() {

  AWS.config.update({
    region: process.env.AWS_REGION,
  });


  const iot = new AWS.Iot();
  const s3 = new AWS.S3();

  const createThingAndAttachCerts = async (thingName) => {
    try {
      const currentDate = new Date().toISOString().slice(0, 10);
      const s3BucketName = 'create-things-with-cert'; // Replace with your S3 bucket name

      // 1. Create new certificate
      const certRes = await new Promise((resolve, reject) => {
        const params = {
          setAsActive: true,
        };
        iot.createKeysAndCertificate(params, function (err, data) {
          if (err) reject(err);
          else resolve(data);
        });
      });

      console.log('certRes >> ', certRes);

      // 2. Attaching policy to certificate

      const policyToCertRes = await new Promise((resolve, reject) => {
        iot.attachPolicy(
          {
            policyName: 'iot_policy',
            target: certRes.certificateArn,
          },
          (err, data) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });
      console.log('policyToCertRes >> ', policyToCertRes);

      // 3. Create Thing

      const thingRes = await new Promise((resolve, reject) => {
        iot.createThing(
          { thingName: thingName },
          function (err, data) {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });

      console.log('thingRes >> ', thingRes);

      // 4. Attach certificate to thing

      const attachedCertThingRes = await new Promise((resolve, reject) => {
        const params = {
          principal: certRes.certificateArn,
          thingName: thingRes.thingName,
        };
        iot.attachThingPrincipal(params, function (err, attachCertRes) {
          if (err) reject(err);
          else resolve(attachCertRes);
        });
      });

      // 5. Save private key to S3

      const privateKeyName = `${thingName}/${currentDate}-private-key.pem`;
      await s3.putObject({
        Bucket: s3BucketName,
        Key: privateKeyName,
        Body: certRes.keyPair.PrivateKey,
        ContentType: 'application/x-pem-file',
      }).promise();
      console.log(`Private key saved to S3 bucket: ${s3BucketName}/${privateKeyName}`);


      // 6. Save public key to S3
      const publicKeyName = `${thingName}/${currentDate}-public-key.pem`;
      await s3.putObject({
        Bucket: s3BucketName,
        Key: publicKeyName,
        Body: certRes.keyPair.PublicKey,
        ContentType: 'application/x-pem-file',
      }).promise();
      console.log(`Public key saved to S3 bucket: ${s3BucketName}/${publicKeyName}`);

      // 7. Save certificate to S3 with date in the object key
      const certificateKeyName = `${thingName}/${currentDate}-certificate.pem`;
      await s3.putObject({
        Bucket: s3BucketName,
        Key: certificateKeyName,
        Body: certRes.certificatePem,
        ContentType: 'application/x-pem-file',
      }).promise();
      console.log(`Certificate saved to S3 bucket: ${s3BucketName}/${certificateKeyName}`);


      console.log('attachedCertThingRes >> ', attachedCertThingRes);

      // return certRes;
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*', // Required for CORS support to work
          'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
          'Access-Control-Allow-Methods': '*',
        },
        statusCode: 200,
        body: JSON.stringify(certRes),
      };
    } catch (e) {
      console.log(e);
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*', // Required for CORS support to work
          'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
          'Access-Control-Allow-Methods': '*',
        },
        statusCode: 200,
        body: { message: e.message },
      };
    }
  };
  const thingName = process.argv[2];


  createThingAndAttachCerts(thingName);
}

main();
