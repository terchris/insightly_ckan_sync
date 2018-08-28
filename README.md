# insightly_ckan_sync
Syncing organisations in Insightly CRM system and CKAN open data portal


The purpose of this code is to sync organisations between www.insightly.com CRM system and the open data portal CKAN (www.ckan.org)

Code is written in javaScript and uses API to communicate with Insightly and CKAN

## Initial version
Reads organisations and main contact from Insightly and populates CKAN

## Requirements
By CKAN does not have attributes for storing the information needed about a organisation. The attributes for a CKAN organisation is extended. See this project for information about the extended properties. https://github.com/terchris/ckanext-scheming

## Software requirements
The scripts are made for running in node. To access CKAN we use the <ckan-node-pacage>


## how to use (initial version)
There are two stages. First srcript reads from Insightly and store the result file on local filestore. Then secon script reads the result file and creates / updates organisations in CKAN.


## Configuration
API keys are required for accessing data on Insightly and for opdating data in CKAN
