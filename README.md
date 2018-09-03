# insightly_ckan_sync

Syncing organisations in Insightly CRM system and CKAN open data portal

The purpose of this code is to sync organisations between www.insightly.com CRM system and the open data portal CKAN (www.ckan.org)

Code is written in javaScript and uses API to communicate with Insightly and CKAN

## Initial version

Reads organisations and main contact from Insightly and populates CKAN

## Requirements

By CKAN does not have attributes for storing the information needed about a organisation. The attributes for a CKAN organisation is extended. See this project for information about the extended properties. https://github.com/terchris/ckanext-scheming

### Install required packages

npm install ckan  (https://www.npmjs.com/package/ckan)
npm install config  (https://www.npmjs.com/package/config)
npm install request (https://www.npmjs.com/package/request)
npm install axios (https://www.npmjs.com/package/axios)

## how to use (initial version)

see program

## Configuration

API keys are required for accessing data on Insightly and for opdating data in CKAN
Copy the config/dafault_template.json to config/default.json

Create a logs directory