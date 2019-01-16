/**
 * insightly_2_ckan
 * terchris/30Oct
 *
 * Latest: changing org tye and insigthly tags. This requires change to terchris/ckanext-scheming
 *
 * Latest: started dev for testing if org needs to be sent to ckan
 *
 * This program reads copy all members of the smart city network to CKAN
 * All organizations from Insightly that has a tag "=SBNmedlemsvirksomhet"
 *
 * Each member organisation marked with "=SBNmedlemsvirksomhet" has main contact person
 * The main contact person is a contact that has a tag "=SBNhovedkontakt"
 * The contact and the organisation is merged.
 *
 * The organisation record in Insightly and CKAN has been extended to hold custom fields.
 *
 * Insightly fields
 *
 *
 * CKAN fields
 * see https://github.com/terchris/ckanext-scheming
 *
 * Installation:
 *
 * Configuration before use:
 *
 * Output:
 *
 * How to use the program:
 * node insightly_2_ckan.js
 *
 */

let request = require('request');
const axios = require("axios"); //to install it: npm install axios
var fs = require('fs'); // filesystem write
var config = require('config');
//TODO: remove var CKAN = require('ckan'); //The ckan client
var throttledQueue = require('throttled-queue');




const insightlyAPIKey  = config.get('Insightly.Config.insightlyAPIKey');
const insightlyURLGetOrgByTag = config.get('Insightly.Config.insightlyURLGetOrgByTag');
//OLD const insightlyURLGetOrgByTag = "https://api.insight.ly/v2.2/Organisations/Search?tag=CKAN-export&top=500";
const insightlyURLgetContactByTag = config.get('Insightly.Config.insightlyURLgetContactByTag');
const insightlyRunLogFile = config.get('Insightly.Output.insightlyRunLogFile');
const insightlyERRLogFile = config.get('Insightly.Output.insightlyERRLogFile');
const insightlyJoinedOutput = config.get('Insightly.Output.insightlyJoinedOutput');

var ckanAPIkey = config.get('CKAN.Config.ckanAPIkey');
// ckanAPIkey = "d466e11f-60f4-4ef3-85b5-9026215d1b22"; //DEBUG: for local ubuntu VM

const CKANhost = config.get('CKAN.Config.CKANhost');
// const CKANhost = "http://172.16.1.96"; //DEBUG: for locak ubunti VM
// const CKANhost = "http://localhost:5000"; //DEBUG: for local docker dcker

const ckanURLgetOrganisations = config.get('CKAN.Config.ckanURLgetOrganisations');

// for throtteling update/create requests to CKAN
var throttleParalell = config.get('CKAN.Config.throttleParalell'); // requests in paralell
var throttleSpacing = config.get('CKAN.Config.throttleSpacing'); // timing between requets 1000 = 1 second
var throttle = throttledQueue(throttleParalell, throttleSpacing); // create the queue
//var throttle = throttledQueue(1, 1000); // create the queue

/****** START CKAN related stuff  */






/** tidyOrganisations
 * removes illegal characters
*/
function tidyOrganisations(orgArray) {
  //debugger;

  for (var i = 0; i < orgArray.length; i++) {
      if (orgArray[i].slogan.length < 1) { //slogan is blank -> fix it
        orgArray[i].slogan = ".";
        log2File("ERR", "Organisation "+ orgArray[i].name + " (no " + i + ") is missing Slogan. setting it to a dot ",orgArray[i]);
      }


      if (orgArray[i].organization_type.length < 1) { //organization_type is blank -> fix it
        orgArray[i].organization_type = "private";
        log2File("ERR", "Organisation "+ orgArray[i].name + " (no " + i + ") is missing organization_type. setting it to a private ",orgArray[i]);
      }

      if (orgArray[i].description == null ) { //description is blank -> fix it
        orgArray[i].description = ".";
        log2File("WARN", "Organisation "+ orgArray[i].name + " (no " + i + ") is missing description. setting it to a dot ",orgArray[i]);
      }



      //problems_solved is stored with ";" as separator. Change it to ",""
      if (orgArray[i].problems_solved != null) {
        orgArray[i].problems_solved = orgArray[i].problems_solved.replace(/;/g, ',');
      }
      // Stop using insightly tags. Just replace witht problems_solved
      orgArray[i].insightly_tags = orgArray[i].problems_solved;


      //organization_segments is stored with ";" as separator. Change it to ",""
      if (orgArray[i].organization_segments != null) {
        orgArray[i].organization_segments = orgArray[i].organization_segments.replace(/;/g, ',');
      }

      // Stop using he old segments. Just replace witht th new ones
      orgArray[i].segment = orgArray[i].organization_segments;



      //make sure it is lowercaase - and replace norwegian letters
      orgArray[i].name = orgArray[i].name.toLowerCase();
      orgArray[i].name = orgArray[i].name.replace(/æ/g, 'ae');
      orgArray[i].name = orgArray[i].name.replace(/ø/g, 'o');
      orgArray[i].name = orgArray[i].name.replace(/å/g, 'a');

      //TODO: temporary fix because we need to expand the org types.
      // These lines maps the new types in insightly to the old ones in ckan.
      // when the sheme for an org is changed in ckan we can remove these lines
      /*
      if (orgArray[i].organization_type == "civil_society_ngo") orgArray[i].organization_type = "civil_society";
      if (orgArray[i].organization_type == "municipality") orgArray[i].organization_type = "public";
      if (orgArray[i].organization_type == "academia") orgArray[i].organization_type = "public";
      if (orgArray[i].organization_type == "association") orgArray[i].organization_type = "public";
      if (orgArray[i].organization_type == "government") orgArray[i].organization_type = "public";
*/


  }

}

/** ckan_create_org
 * creates a new org in ckan
 *
 * see http://docs.ckan.org/en/latest/api/#ckan.logic.action.create.organization_create
 */
function ckan_create_org(newOrg) {
  var CKAN_API = "organization_create";

  var CKAN_urbalurba_import_record =
    {
        "title": newOrg.title,
        "name": newOrg.name,
        "slogan": newOrg.slogan,
        "website": newOrg.website,
        "organization_type": newOrg.organization_type,
        "description": newOrg.description,
        "image_url": newOrg.image_url,
        "member": newOrg.member,
        "organization_number": newOrg.organization_number,
        "main_adddress": newOrg.main_adddress,
        "phone": newOrg.phone,
        "contact_name": newOrg.contact_name,
        "contact_title": newOrg.contact_title,
        "contact_email": newOrg.contact_email,
        "contact_mobile": newOrg.contact_mobile,
        "member_tags": newOrg.member_tags,
        "segment": newOrg.segment,
        "insightly_id": newOrg.insightly_id,
        "insightly_tags": newOrg.insightly_tags,
        "sustainable_development_goals" : newOrg.Sustainable_Development_Goals,
        "employee_resource_id" : newOrg.employee_resource_id
      };



    CKAN_parameters = CKAN_urbalurba_import_record;



    log2File("OK", "Trying to create: "+JSON.stringify(CKAN_parameters.title),"");


    throttle(function () { // queue all requests
          client.action(CKAN_API, CKAN_parameters,
           function (err, result) {
            if (err != null) { //some error - try figure out what
                log2File("ERR", "ERROR on create :" + JSON.stringify(result),err);
            } else // we have managed to update. We are getting the full info for the org as the result
            {
                log2File("OK", "Created :" + JSON.stringify(result.result.display_name),"");
            }

        });
      });
};



/** ckan_create_org_axios
 * creates a new org in ckan using axios
 *
 * see http://docs.ckan.org/en/latest/api/#ckan.logic.action.create.organization_create
 */
function ckan_create_org_axios(newOrg) {


  var CKAN_urbalurba_import_record =
    {
        "title": newOrg.title,
        "name": newOrg.name,
        "slogan": newOrg.slogan,
        "website": newOrg.website,
        "organization_type": newOrg.organization_type,
        "description": newOrg.description,
        "image_url": newOrg.image_url,
        "member": newOrg.member,
        "organization_number": newOrg.organization_number,
        "main_adddress": newOrg.main_adddress,
        "phone": newOrg.phone,
        "contact_name": newOrg.contact_name,
        "contact_title": newOrg.contact_title,
        "contact_email": newOrg.contact_email,
        "contact_mobile": newOrg.contact_mobile,
        "member_tags": newOrg.member_tags,
        "segment": newOrg.segment,
        "insightly_id": newOrg.insightly_id,
        "insightly_tags": newOrg.insightly_tags,
        "sustainable_development_goals" : newOrg.Sustainable_Development_Goals,
        "locationData" : newOrg.locationData,
        "urbalurbaData" : newOrg.urbalurbaData        
      };

      axios.defaults.baseURL = CKANhost;
      axios.defaults.headers.common['Authorization'] = ckanAPIkey;


    log2File("OK", "Trying to AXIOS create: "+JSON.stringify(CKAN_urbalurba_import_record.title),"");

    throttle(function () { // queue all requests
      axios.post('/api/3/action/organization_create', CKAN_urbalurba_import_record)

        .then(function (response) {
          console.log(response);
          log2File("OK", "Created AXIOS:" + JSON.stringify(response.data.result),"");
        })
        .catch(function (error) {
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
          } else if (error.request) {
            // The request was made but no response was received
            // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
            // http.ClientRequest in node.js
            console.log(error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.log('Error', error.message);
          }
          console.log(error.config);
        });
    });


};







/** ckan_update_org_axios
 * update using axios
 */
function ckan_update_org_axios(newOrg) {

  var CKAN_urbalurba_import_record =
  {
      "title": newOrg.title,
      "name": newOrg.name,
      "slogan": newOrg.slogan,
      "website": newOrg.website,
      "organization_type": newOrg.organization_type,
      "description": newOrg.description,
      "image_url": newOrg.image_url,
      "member": newOrg.member,
      "organization_number": newOrg.organization_number,
      "main_adddress": newOrg.main_adddress,
      "phone": newOrg.phone,
      "contact_name": newOrg.contact_name,
      "contact_title": newOrg.contact_title,
      "contact_email": newOrg.contact_email,
      "contact_mobile": newOrg.contact_mobile,
      "member_tags": newOrg.member_tags,
      "segment": newOrg.segment,
      "insightly_id": newOrg.insightly_id,
      "insightly_tags": newOrg.insightly_tags,
      "sustainable_development_goals" : newOrg.Sustainable_Development_Goals,
      "locationData" : newOrg.locationData,
      "urbalurbaData" : newOrg.urbalurbaData,           
      "employee_resource_id" : newOrg.employee_resource_id,
      "id" : newOrg.CKAN_ID,
    };

  axios.defaults.baseURL = CKANhost;
  axios.defaults.headers.common['Authorization'] = ckanAPIkey;



  log2File("OK", "Trying to AXIOS update: "+JSON.stringify(CKAN_urbalurba_import_record.title),"");

  throttle(function () { // queue all requests
    axios.post('/api/3/action/organization_patch', CKAN_urbalurba_import_record)

      .then(function (response) {
        console.log(response);
        log2File("OK", "Updated AXIOS:" + JSON.stringify(response.data.result),"");
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
        console.log(error.config);
      });
  });


};




/** ckan_update_org
 * updates a org in ckan
 * see http://docs.ckan.org/en/latest/api/#ckan.logic.action.patch.organization_patch
 *
 */
function ckan_update_org(newOrg) {
  var CKAN_API = "organization_patch";

  var CKAN_urbalurba_import_record =
    {
        "title": newOrg.title,
        "name": newOrg.name,
        "slogan": newOrg.slogan,
        "website": newOrg.website,
        "organization_type": newOrg.organization_type,
        "description": newOrg.description,
        "image_url": newOrg.image_url,
        "member": newOrg.member,
        "organization_number": newOrg.organization_number,
        "main_adddress": newOrg.main_adddress,
        "phone": newOrg.phone,
        "contact_name": newOrg.contact_name,
        "contact_title": newOrg.contact_title,
        "contact_email": newOrg.contact_email,
        "contact_mobile": newOrg.contact_mobile,
        "member_tags": newOrg.member_tags,
        "segment": newOrg.segment,
        "insightly_id": newOrg.insightly_id,
        "insightly_tags": newOrg.insightly_tags,
        "sustainable_development_goals" : newOrg.Sustainable_Development_Goals,
        "employee_resource_id" : newOrg.employee_resource_id,
        "id" : newOrg.CKAN_ID,
      };



    CKAN_parameters = CKAN_urbalurba_import_record;



    log2File("OK", "Trying to update: "+JSON.stringify(CKAN_parameters.title),"");

         client.action(CKAN_API, CKAN_parameters,
           function (err, result) {
            if (err != null) { //some error - try figure out what
                log2File("ERR", "ERROR on Update :" + JSON.stringify(result),err);
            } else // we have managed to update. We are getting the full info for the org as the result
            {
                log2File("OK", "Updated :" + JSON.stringify(result.result.display_name),"");
            }

        });

};



/** updateCKANorganizations
 * Loop trugh all organizations and publish them to CKAN
 * Existing organizations are updated and new are created
 * IF the organisation or contact has not been updated in insightly since last export
 * then there s no point updating the same data
 * (this asumes that only edit source is insightly. NOT testing if ckan has been updated)
 */
function updateCKANorganizations(organizationArray) {
  //debugger;
  for (var i = 0; i < organizationArray.length; i++) {
    org = organizationArray[i];

      if (org.CKAN_ID == "")
        ckan_create_org_axios(org); // Create if the org is not in CKAN
      else
        if (1==1) // for debugging
        //if (org.ckan_source_insightly_org_date_updated_utc != org.insightly_source_insightly_org_date_updated_utc)
        {
          ckan_update_org_axios(org);
        }


  }

}



/** getLocationData
 * Loop trugh all organizations and add geolocation data to organisation
 * Adds all geolocation data to a new tag under the organisation.
 * geo-data includes latlng coordinates to organisation HQ and ????
 * 
 * Contents of the tag is generated each time data is pushed to CKAN
 * 
 * Tag name is "locationData"
 * Tag has the following format:
 *    {
 *      latlng: {
 *                lat: y,
 *                lng: x
 *              },
 *      ??: {
 *            --
 *          }
 *    }
 */
async function getLocationData(allDataJoined) {
  for(var i = 0; i < allDataJoined.length; i++) {

    await axios.get('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates',
      {
        params: {
          outSr: 4326,
          forStorage: false,
          outFields: '*',
          maxLocations: 20,
          f: 'json',
          address: encodeURI(org.main_adddress)
        }
      })
      .then(function(response) {
        var res = response.data;

        if(res.candidates.length > 0) {

          allDataJoined[i].locationData = {
            latlng: {
              lat: res.candidates[0].location.y,
              lng: res.candidates[0].location.x
            }
          };

        }else{
          console.log("No latlng results found from main address");
        }
      })
      .catch(function(error) {
        console.log(error);
      });
  }
}





/****** STOP CKAN related stuff  */




/** log2File
 * logs to file
 * If logType is "ERR" then we log to insightlyERRLogFile othervise in insightlyRunLogFile
 *
 */
function log2File(logType, logText, jsonObject){
var logFile="";
var date = new Date();

var myobj = JSON.stringify(jsonObject);

var logRecord = {
    datetime: date.toJSON(),
    logtype: logType,
    logtxt: logText,
    jsonobject: JSON.stringify(jsonObject)
}
  if (logType == "ERR")
    logFile = insightlyERRLogFile;
  else
    logFile = insightlyRunLogFile;


  console.log(JSON.stringify(logRecord));

  fs.appendFile(logFile, JSON.stringify(logRecord) + ",", function (err) {
      if (err) throw err;
      });

}


/*** emptyContact
 * used by joinOrgContact when a organisation does not have a corresponding contact
 * This routine returns a empty contact record.
 */
function emptyContact() {
 var contactRecord =     {
  "CONTACT_ID": 1,
  "SALUTATION": null,
  "FIRST_NAME": "",
  "LAST_NAME": "ingen kontaktperson",
  "BACKGROUND": null,
  "IMAGE_URL": null,
  "DEFAULT_LINKED_ORGANISATION": 1,
  "OWNER_USER_ID": 1212582,
  "DATE_CREATED_UTC": "2016-09-23 07:42:19",
  "DATE_UPDATED_UTC": "2018-04-12 18:01:13",
  "VISIBLE_TO": "EVERYONE",
  "VISIBLE_TEAM_ID": null,
  "VISIBLE_USER_IDS": null,
  "CUSTOMFIELDS": [],
  "ADDRESSES": null,
  "CONTACTINFOS": [
      {
          "CONTACT_INFO_ID": 1,
          "TYPE": "PHONE",
          "SUBTYPE": null,
          "LABEL": "WORK",
          "DETAIL": "00000000"
      },
      {
          "CONTACT_INFO_ID": 1,
          "TYPE": "EMAIL",
          "SUBTYPE": null,
          "LABEL": "WORK",
          "DETAIL": "no.email@address.no"
      }
  ],
  "DATES": [],
  "TAGS": [
      {
          "TAG_NAME": "SmartCity"
      }
  ],
  "LINKS": [
      {
          "LINK_ID": 1,
          "CONTACT_ID": 1,
          "OPPORTUNITY_ID": null,
          "ORGANISATION_ID": 1,
          "PROJECT_ID": null,
          "SECOND_PROJECT_ID": null,
          "SECOND_OPPORTUNITY_ID": null,
          "ROLE": "ingen",
          "DETAILS": null
      }
  ],
  "CONTACTLINKS": [
      {
          "CONTACT_LINK_ID": 1,
          "FIRST_CONTACT_ID": 1,
          "SECOND_CONTACT_ID": 1,
          "RELATIONSHIP_ID": 1,
          "DETAILS": null
      },
      {
          "CONTACT_LINK_ID": 1,
          "FIRST_CONTACT_ID": 1,
          "SECOND_CONTACT_ID": 1,
          "RELATIONSHIP_ID": 1,
          "DETAILS": null
      }
  ],
  "CAN_EDIT": true,
  "CAN_DELETE": true,
  "SOCIAL_LINKEDIN": "",
  "SOCIAL_FACEBOOK": "",
  "SOCIAL_TWITTER": "",
  "ASSISTANT_NAME": null
};

 return contactRecord;

}


/**
 * join is joining two tables
 * I learned howto here http://learnjsdata.com/combine_data.html
 *
 */
function joinOrgContact(lookupTable, mainTable, lookupKey, mainKey, select) {
  var l = lookupTable.length,
    m = mainTable.length,
    lookupIndex = [],
    output = [];
  for (var i = 0; i < l; i++) { // loop through l items
    var row = lookupTable[i];
    lookupIndex[row[lookupKey]] = row; // create an index for lookup table
  }
  for (var j = 0; j < m; j++) { // loop through m items
    var y = mainTable[j];
    var x = lookupIndex[y[mainKey]]; // get corresponding row from lookupTable
    if (typeof x != 'undefined') {
      output.push(select(y, x)); // select only the columns you need
    } else {
      output.push(select(y, emptyContact())); // well. if they dont have a main contact. Add them anyway
      log2File("ERR", "Organisation "+ y.ORGANISATION_NAME + " (no " + j + ") is missing =SBNHovedkontakt ",y);
    }
  }
  return output;
};


/** joinInsightlyCKAN
 * join is joining insightly org records and CKAN org records
 * ID in insightly org is "insightly_id"
 * ID in CKAN org record is "id"
 * http://learnjsdata.com/combine_data.html
 *
 */
function joinInsightlyCKAN(lookupTable, mainTable, lookupKey, mainKey, select) {
  var l = lookupTable.length,
    m = mainTable.length,
    lookupIndex = [],
    output = [];
  for (var i = 0; i < l; i++) { // loop through l items
    var row = lookupTable[i];
    lookupIndex[row[lookupKey]] = row; // create an index for lookup table
  }
  for (var j = 0; j < m; j++) { // loop through m items
    var y = mainTable[j];
    var x = lookupIndex[y[mainKey]]; // get corresponding row from lookupTable
    if (typeof x != 'undefined') {
      output.push(select(y, x)); // select only the columns you need
    } else {
      output.push(select(y, {id: ""} )); // the org does not exist in ckan
      log2File("OK", "joinInsightlyCKAN Organisation "+ y.name + " (no " + j + ") will is new and will be created ",y);
    }
  }
  return output;
};






/**
 * Get the organisations that are tagged with
 *
 */
function insightlyGetOrgByTag() {
  return axios.get(insightlyURLGetOrgByTag, {
    auth: {
      username: insightlyAPIKey
    }
  })
    .then(function (response) {
      return (response.data);
    })
    .catch(function (error) {
      log2File("ERR", "insightlyGetOrgByTag", error.response.statusText);
    });
};



function insightlyGetContactByTag() {
  return axios.get(insightlyURLgetContactByTag, {
    auth: {
      username: insightlyAPIKey
    }
  })
    .then(function (response) {
      return (response.data);
    })
    .catch(function (error) {
      log2File("ERR", "insightlyGetContactByTag", error.response.statusText);
    });
};

/** ckanGetOrganisations
 * read all organisations from the ckan server. return object with all organisations
 */
function ckanGetOrganisations() {
  var ckanURL = CKANhost + ckanURLgetOrganisations;

  return axios.get(ckanURL )
    .then(function (response) {
      return (response.data.result);
    })
    .catch(function (error) {
      log2File("ERR", "ckanGetOrganisations", error.response.statusText);
    });
};




/** getAllData
 * read data from insightly and ckan
 */
function getAllData() {
  return axios.all([insightlyGetOrgByTag(), insightlyGetContactByTag(), ckanGetOrganisations()])
}


/** getCustomField
 *  returns the value of the fieldName provided in the parameter.
 *  orgRecord parameter is the org we are extracting the custom field from
 *  If the tag is not defined it returns ""
 * custom fields is in a structure like this:
 *         "CUSTOMFIELDS": [
            {
                "CUSTOM_FIELD_ID": "slogan__c",
                "FIELD_VALUE": "Strategisk samarbeid mellom 15 kommuner"
            },
            {
                "CUSTOM_FIELD_ID": "CKAN_LOGO_IMAGE__c",
                "FIELD_VALUE": "http://bucket.urbalurba.com/logo/vestregionen.jpg"
            },
            {
                "CUSTOM_FIELD_ID": "CKAN_NAME__c",
                "FIELD_VALUE": "vestregionen"
            },
            {
                "CUSTOM_FIELD_ID": "organization_type__c",
                "FIELD_VALUE": "public"
            }
        ]
 *
 */
function insightlyGetCustomField(fieldName,orgRecord){
  //debugger;
  fieldName = fieldName +"__c"; // custom field has a __c ending
  if(orgRecord.hasOwnProperty("CUSTOMFIELDS")){ //if there are costom fields here
    if(Array.isArray(orgRecord.CUSTOMFIELDS)){ // and it is an array
      theCustomFields = orgRecord.CUSTOMFIELDS;
      for (var i = 0; i < theCustomFields.length; i++) {
        // V2.2 API if(theCustomFields[i].CUSTOM_FIELD_ID == fieldName) { // we found it
        if(theCustomFields[i].FIELD_NAME == fieldName) { // we found it
          return theCustomFields[i].FIELD_VALUE ;
        }
      }

    }
  }

  return ""; // not found
}



/** getContactinfos
 *  returns the value of the fieldName provided in the parameter.
 *  orgRecord parameter is the org we are extracting the custom field from
 *  If the tag is not defined it returns ""
 * contactinfos is in a structure like this:
 *         "CONTACTINFOS": [
            {
                "CONTACT_INFO_ID": 40095288967,
                "TYPE": "PHONE",
                "SUBTYPE": null,
                "LABEL": "WORK",
                "DETAIL": "930 01 000"
            },
            {
                "CONTACT_INFO_ID": 60095288967,
                "TYPE": "WEBSITE",
                "SUBTYPE": null,
                "LABEL": "WORK",
                "DETAIL": "https://www.acando.no/"
            },
            {
                "CONTACT_INFO_ID": 2333270,
                "TYPE": "EMAILDOMAIN",
                "SUBTYPE": null,
                "LABEL": null,
                "DETAIL": "acando.no"
            },
            {
                "CONTACT_INFO_ID": 5631943,
                "TYPE": "EMAILDOMAIN",
                "SUBTYPE": null,
                "LABEL": null,
                "DETAIL": "acando.com"
            }
        ]
 *
 */
function insightlyGetContactinfos(fieldName,orgRecord){
  //debugger;

  if(orgRecord.hasOwnProperty("CONTACTINFOS")){ //if there are costom fields here
    if(Array.isArray(orgRecord.CONTACTINFOS)){ // and it is an array
      theContactinfos = orgRecord.CONTACTINFOS;
      for (var i = 0; i < theContactinfos.length; i++) {
        if(theContactinfos[i].TYPE == fieldName) { // we found it
          return theContactinfos[i].DETAIL ;
        }
      }

    }
  }

  return ""; // not found
}


/** getAddress This was version 2 of the insightly API
 *  returns the value of the fieldName provided in the parameter.
 *  orgRecord parameter is the org we are extracting the custom field from
 *  If the tag is not defined it returns "Norway"
 * contactinfos is in a structure like this:
 *        "ADDRESSES": [
            {
                "ADDRESS_ID": 20100336261,
                "ADDRESS_TYPE": "PRIMARY",
                "STREET": "Glengsgata 38",
                "CITY": "Sarpsborg",
                "STATE": null,
                "POSTCODE": "1702",
                "COUNTRY": "Norway"
            }
        ]
 *


The latest API structure looks like this
ADDRESS_SHIP_CITY: "Brønnøysund",
ADDRESS_SHIP_COUNTRY: "Norway",
ADDRESS_SHIP_POSTCODE: "8900",
ADDRESS_SHIP_STREET: "Havnegata 48",



 */
function insightlyGetAddress(orgRecord){
var fullAddress ="";

  if(orgRecord.hasOwnProperty("ADDRESS_SHIP_STREET")){
    if (orgRecord.ADDRESS_SHIP_STREET != null) {
        fullAddress = fullAddress + orgRecord.ADDRESS_SHIP_STREET;
    }
  }

  if(orgRecord.hasOwnProperty("ADDRESS_SHIP_POSTCODE")){
    if (orgRecord.ADDRESS_SHIP_POSTCODE != null) {
      fullAddress = fullAddress + ", " + orgRecord.ADDRESS_SHIP_POSTCODE;
    }
  }


  if(orgRecord.hasOwnProperty("ADDRESS_SHIP_CITY")){
    if (orgRecord.ADDRESS_SHIP_CITY != null) {
      fullAddress = fullAddress + " " + orgRecord.ADDRESS_SHIP_CITY;
    }
  }


  if(orgRecord.hasOwnProperty("ADDRESS_SHIP_COUNTRY")){
    if (orgRecord.ADDRESS_SHIP_COUNTRY != null) {
      fullAddress = fullAddress + ", " + orgRecord.ADDRESS_SHIP_COUNTRY;
    }
  } else {
    fullAddress = fullAddress + ", Norway";
  }


  return fullAddress ;


}


/** getContactTitle
 * Finds the title that the contact has in the primary/main company she works for
 * The rimary/main org is set by
 *         "DEFAULT_LINKED_ORGANISATION": 90640729
 *
 * Returns the title if there is one - othervise ""
 *
 * The structure holding the titles looks like this
 *         "LINKS": [
            {
                "LINK_ID": 121263263,
                "CONTACT_ID": 188875468,
                "OPPORTUNITY_ID": null,
                "ORGANISATION_ID": 90640729,
                "PROJECT_ID": null,
                "SECOND_PROJECT_ID": null,
                "SECOND_OPPORTUNITY_ID": null,
                "ROLE": "Client Partner",
                "DETAILS": null
            },
            {
                "LINK_ID": 129717280,
                "CONTACT_ID": 188875468,
                "OPPORTUNITY_ID": null,
                "ORGANISATION_ID": 90706760,
                "PROJECT_ID": null,
                "SECOND_PROJECT_ID": null,
                "SECOND_OPPORTUNITY_ID": null,
                "ROLE": "Boardmember Mobile strategy",
                "DETAILS": null
            },
            {
                "LINK_ID": 132654672,
                "CONTACT_ID": 188875468,
                "OPPORTUNITY_ID": null,
                "ORGANISATION_ID": 100336622,
                "PROJECT_ID": null,
                "SECOND_PROJECT_ID": null,
                "SECOND_OPPORTUNITY_ID": null,
                "ROLE": "CEO & Founder",
                "DETAILS": null
            }
        ]
 */
function insightlyGetContactTitle(contact) {
  //debugger;
  if(contact.hasOwnProperty("DEFAULT_LINKED_ORGANISATION")){
    primaryOrg = contact.DEFAULT_LINKED_ORGANISATION;
    if(contact.hasOwnProperty("LINKS")){
      if(Array.isArray(contact.LINKS)){ // and it is an array
        theLinks = contact.LINKS;
        for (var i = 0; i < theLinks.length; i++) {
          if(theLinks[i].ORGANISATION_ID == primaryOrg) { // we found it
            return theLinks[i].ROLE;
          }
        }
      }
    }
  }
  return ""; // did not find a role
}



/** getTags
 * Returns tags on a record as a comma separated string.
 * If there are no tags then it returns ""
 * The tag structure looks like this
 *  "TAGS": [
            {
                "TAG_NAME": "+Stavanger"
            },
            {
                "TAG_NAME": "=SBNmedlemsvirksomhet"
            },
            {
                "TAG_NAME": "SS_Privat"
            }
        ]
 */
function insightlyGetTags(orgRecord){
//debugger;
  if(orgRecord.hasOwnProperty("TAGS")){
    if(Array.isArray(orgRecord.TAGS)){ // and it is an array
      theTags = orgRecord.TAGS;
      comma =""; //no leading comma
      tagString = "";
      for (var i = 0; i < theTags.length; i++) {
        tagString = tagString + comma + theTags[i].TAG_NAME
        comma =","; //now we put a comma
      }
      return tagString;
    }
  }
  return ""; // no tags
}


/*** isMember
 * return yes if the organisation has a tag "=SBNmedlemsvirksomhet"
 * if not it returns "no"
 */
function insightlyIsMember(orgRecord){
//debugger;
  tagString = insightlyGetTags(orgRecord);
  var n = tagString.indexOf("SBNmedlemsvirksomhet");
  if( n != -1)
    return "yes";
  else
    return "no"

}


/**** Main code start
 *
 */

//TODO: remove var client = new CKAN.Client(CKANhost, ckanAPIkey); // initiate connection to CKAN


getAllData()
  .then(async ([insightlyOrgs, insightlyContacts, ckanOrgs]) => {

    log2File("OK", "Insightly Organisations ("+ insightlyOrgs.length + ") / Insightly contacts ("+ insightlyContacts.length + ") / CKAN Organisations (" + ckanOrgs.length + ") read successfully","");
    // Fordebugging in the console do: insightlyOrgs.find(org => org.ORGANISATION_NAME === 'ABAX' );

    var insightlyJoinedOrganisation = joinOrgContact(insightlyContacts, insightlyOrgs, "DEFAULT_LINKED_ORGANISATION", "ORGANISATION_ID", function (organisasjonen, kontakten) {
      return {
        title: organisasjonen.ORGANISATION_NAME,
        name: insightlyGetCustomField("CKAN_NAME", organisasjonen),
        slogan: insightlyGetCustomField("slogan", organisasjonen),
        //website: insightlyGetContactinfos("WEBSITE",organisasjonen),
        website: organisasjonen.WEBSITE,
        organization_type: insightlyGetCustomField("organization_type", organisasjonen),
        description: organisasjonen.BACKGROUND,
        image_url: insightlyGetCustomField("CKAN_LOGO_IMAGE", organisasjonen),
        member: insightlyIsMember(organisasjonen),
        organization_number: insightlyGetCustomField("Organisasjonsnummer", organisasjonen),
        main_adddress: insightlyGetAddress(organisasjonen),
        //phone: insightlyGetContactinfos("PHONE",organisasjonen),
        phone: organisasjonen.PHONE,
        contact_name: kontakten.FIRST_NAME + " " + kontakten.LAST_NAME,
        contact_title: insightlyGetContactTitle(kontakten),
        contact_email: insightlyGetContactinfos("EMAIL",kontakten),
        contact_mobile: insightlyGetContactinfos("PHONE",kontakten),
        member_tags: insightlyGetCustomField("member_tags", organisasjonen),
        segment: insightlyGetCustomField("segment", organisasjonen),
        insightly_id: organisasjonen.ORGANISATION_ID,
        insightly_tags: insightlyGetTags(organisasjonen),
        Sustainable_Development_Goals: insightlyGetCustomField("Sustainable_Development_Goals", organisasjonen),
        employee_resource_id: insightlyGetCustomField("CKAN_EMPLOYEE_RESOURCE_ID", organisasjonen),
        insightly_org_date_updated_utc: organisasjonen.DATE_UPDATED_UTC,
        insightly_contact_date_updated_utc: kontakten.DATE_UPDATED_UTC,
        organization_segments: insightlyGetCustomField("organization_segments", organisasjonen),
        problems_solved: insightlyGetCustomField("problems_solved", organisasjonen),
      };
    });
// Fordebugging in the console do: insightlyJoinedOrganisation.find(org => org.title === 'ABAX' );

    if (insightlyOrgs.length > insightlyJoinedOrganisation.length)  //If there are more organisations than the joined result. Then report the error
      log2File("ERR", "Missing contacts","");
    else
      log2File("OK", "Joined Organisations and contacts","");


      var allDataJoined = joinInsightlyCKAN(ckanOrgs, insightlyJoinedOrganisation, "insightly_id", "insightly_id", function (theInsightlyOrg, theCkanOrg ) {
        return {
          title: theInsightlyOrg.title,
          name: theInsightlyOrg.name,
          slogan: theInsightlyOrg.slogan,
          website: theInsightlyOrg.website,
          organization_type: theInsightlyOrg.organization_type,
          description: theInsightlyOrg.description,
          image_url: theInsightlyOrg.image_url,
          member: theInsightlyOrg.member,
          organization_number: theInsightlyOrg.organization_number,
          main_adddress: theInsightlyOrg.main_adddress,
          phone: theInsightlyOrg.phone,
          contact_name: theInsightlyOrg.contact_name,
          contact_title: theInsightlyOrg.contact_title,
          contact_email: theInsightlyOrg.contact_email,
          contact_mobile: theInsightlyOrg.contact_mobile,
          member_tags: theInsightlyOrg.member_tags,
          segment: theInsightlyOrg.segment,
          insightly_id: theInsightlyOrg.insightly_id,
          insightly_tags: theInsightlyOrg.insightly_tags,
          Sustainable_Development_Goals: theInsightlyOrg.Sustainable_Development_Goals,
          employee_resource_id: theInsightlyOrg.employee_resource_id,
          CKAN_ID: theCkanOrg.id,
          insightly_source_insightly_org_date_updated_utc: theInsightlyOrg.insightly_org_date_updated_utc,
          insightly_source_insightly_contact_date_updated_utc: theInsightlyOrg.insightly_contact_date_updated_utc,
          ckan_source_insightly_org_date_updated_utc: theInsightlyOrg.insightly_org_date_updated_utc, //TODO: replace with ckan data
          ckan_source_insightly_contact_date_updated_utc: theInsightlyOrg.insightly_contact_date_updated_utc,  //TODO: replace with ckan data
          organization_segments: theInsightlyOrg.organization_segments,
          problems_solved: theInsightlyOrg.problems_solved
        };
      });
  // Fordebugging in the console do: allDataJoined.find(org => org.title === 'ABAX' );

    fs.writeFile(insightlyJoinedOutput, JSON.stringify(allDataJoined), function (err) {
      if (err) throw err;
      log2File("OK", "Joined result written to file: " +insightlyJoinedOutput,"");
      });

    tidyOrganisations(allDataJoined); //remove illegal chars and allert missing fields

    await getLocationData(allDataJoined); // Adds geolocation data to organisations

    updateCKANorganizations(allDataJoined); //Push all data to CKAN

    






  })
