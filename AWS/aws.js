// const sharp = require('sharp');
const aws = require('aws-sdk');

// AWS Configuration
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-south-1',
});

// Function to upload a file to AWS S3
let uploadFile = async (file, folderName) => {
  return new Promise(function (resolve, reject) {
    let s3 = new aws.S3({ apiVersion: '2006-03-01' });

    const uploadImg = (buffer) => {
      var uploadParams = {
        ACL: 'public-read',
        Bucket: 'dresscode-imgs',
        Key: `${folderName}/` + file.originalname,
        Body: buffer,
      };

      s3.upload(uploadParams, function (err, data) {
        if (err) {
          console.log(err.message);
          return reject({ error: err.message });
        }
        console.log('File uploaded successfully');
        return resolve(data.Location);
      });
    };
    uploadImg(file.buffer);
  });
};

// Function to delete a file from AWS S3
let deleteFile = async (fileName, folderName) => {
  return new Promise((resolve, reject) => {
    let s3 = new aws.S3({ apiVersion: '2006-03-01' });

    var deleteParams = {
      Bucket: 'pab-volunteer-imgs',
      Key: `${folderName}/` + fileName,
    };

    s3.deleteObject(deleteParams, function (err, data) {
      if (err) {
        return reject({ error: err.message });
      }
      console.log('File deleted successfully');
      return resolve(data);
    });
  });
};

// Exporting the functions
module.exports = { uploadFile, deleteFile };
