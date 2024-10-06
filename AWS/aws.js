const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { fromEnv } = require('@aws-sdk/credential-provider-env');

// AWS Configuration for SDK v3
const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: fromEnv(), // Automatically loads credentials from environment variables
});

// Function to upload a file to AWS S3 using SDK v3
const uploadFile = async (file, folderName) => {
  try {
    const uploadParams = {
      ACL: 'public-read',
      Bucket: 'dresscode-buck',
      Key: `${folderName}/${file.originalname}`,
      Body: file.buffer,
    };

    const command = new PutObjectCommand(uploadParams);
    const data = await s3Client.send(command);
    console.log('File uploaded successfully');
    // Encode the file name to handle spaces and special characters
    const encodedFileName = encodeURIComponent(file.originalname);
    const location = `https://${uploadParams.Bucket}.s3.ap-south-1.amazonaws.com/${folderName}/${encodedFileName}`;
    return location;
  } catch (err) {
    console.error('Error uploading file:', err.message);
    throw err; // Rethrowing the error to handle it outside this function if necessary
  }
};

// Function to upload a PDF to AWS S3 using SDK v3
const uploadPdfToS3 = async (pdfBuffer, fileName, folderName) => {
  try {
    // Using high-level Upload class from lib-storage for managed uploads
    const uploader = new Upload({
      client: s3Client,
      params: {
        ACL: 'public-read',
        Bucket: 'dresscode-buck',
        Key: `${folderName}/${fileName}`,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      },
    });

    const result = await uploader.done();
    const location = `https://${uploader.params.Bucket}.s3.ap-south-1.amazonaws.com/${uploader.params.Key}`;
    return location;
  } catch (err) {
    console.error('Error uploading PDF to S3', err);
    throw err;
  }
};

// Function to delete a file from AWS S3 using SDK v3
const deleteFile = async (fileName, folderName) => {
  try {
    const deleteParams = {
      Bucket: 'dresscode-buck',
      Key: `${folderName}/${fileName}`,
    };

    const command = new DeleteObjectCommand(deleteParams);
    const data = await s3Client.send(command);
    console.log('File deleted successfully');
    return data;
  } catch (err) {
    console.error('Error deleting file:', err.message);
    throw err;
  }
};

// Exporting the functions
module.exports = { uploadFile, deleteFile, uploadPdfToS3 };

