/**
 * @fileoverview This file contains JavaScript code for interacting with a cloner device via Bluetooth.
 * 
 * It includes functions for connecting to the cloner, sending and receiving data, setting up notifications,
 * and controlling the cloner device. It also provides utility functions for storing and retrieving RFID codes
 * in local storage and updating the user interface.
 * @author DanGeorge & NathanStrandberg
 */

/**
 * The cloner device object obtained from the Bluetooth connection.
 * @type {BluetoothDevice}
 */
let cloner;

/**
 * The GATT server object representing the connection to the cloner peripheral.
 * @type {BluetoothRemoteGATTServer}
 */
let server;

/**
 * The main service object for the cloner device.
 * @type {BluetoothRemoteGATTService}
 */
let service;

/**
 * The ID for writing badge data to the cloner.
 * @type {number}
 */
let write_badge_to_cloner_ID = 0x0001;

/**
 * The ID for receiving badge data from the cloner.
 * @type {number}
 */
let receive_badge_from_cloner_ID = 0x0002;

/**
 * The ID for the command to scan a badge on the cloner.
 * @type {number}
 */
let scan_badge_command = 0x0003;

/**
 * The ID for the command to turn off the cloner device.
 * @type {number}
 */
let turn_off_device_command = 0x0004;

/**
 * The decoder object used to convert byte data into strings.
 * @type {TextDecoder}
 */
let decoder = new TextDecoder();

/**
 * The encoder object used to convert strings into byte data.
 * @type {TextEncoder}
 */
let encoder = new TextEncoder();

/**
 * The characteristic for transmitting data from the cloner to the web application.
 * @type {BluetoothRemoteGATTCharacteristic}
 */
let cloner_transmit_characteristic;

/**
 * The characteristic for receiving data from the web application to the cloner.
 * @type {BluetoothRemoteGATTCharacteristic}
 */
let cloner_receive_characteristic;

/**
 * The characteristic for sending the command to scan a badge on the cloner.
 * @type {BluetoothRemoteGATTCharacteristic}
 */
let cloner_scan_command_characteristic;

/**
 * The characteristic for sending the command to turn off the cloner device.
 * @type {BluetoothRemoteGATTCharacteristic}
 */
let cloner_turn_off_characteristic;

/**
 * The data received from the cloner device and sent to the web application.
 * @type {DataView}
 */
let cloner_to_web_data;



//FUNCTIONS***********************************************************************************



/**
 * Connects to the cloner device via Bluetooth.
 * @returns {Promise<void>} A promise that resolves when the connection is established.
 */
async function connect_to_cloner() {
    //device find
    cloner = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
    });

    //connect to cloner peripheral
    console.log('Connecting to Cloner Peripheral...');
    server = await cloner.gatt.connect();
    //get cloner service
    console.log('Getting main service...');
    //service = await server.getPrimaryService('battery_service');
    service = await server.getPrimaryService('battery_service');

    //get characteristics from cloner. these characteristics will link to buttons in website. they will each serve as different command for device
    console.log('Getting characteristics');
    cloner_transmit_characteristic = await service.getCharacteristic(receive_badge_from_cloner_ID);
    cloner_receive_characteristic = await service.getCharacteristic(write_badge_to_cloner_ID);
    cloner_scan_command_characteristic = await service.getCharacteristic(scan_badge_command);
    cloner_turn_off_characteristic = await service.getCharacteristic(turn_off_device_command);
    //publish device name to website
    document.getElementById("bluetooth_device_name").innerHTML = cloner.name;
    //start notification services for cloner
    setup_RFID_notifications();
    console.log("DONE!");
}




/**
 * Sends badge number to the cloner via button push.
 * @returns {Promise<void>} A promise that resolves when the data is sent to the cloncer.
 */
async function send_data_to_cloner() {
    try {
        //let new_RFID_UID = document.getElementById("text_box").value;
        let val = document.getElementById("text_box").value;
        //save custom UID to list of ID's
        storeRFIDCode(val);
        
        //convert to byte array
        let byte_buff = await encoder.encode(val);
        await cloner_receive_characteristic.writeValue(byte_buff);
        console.log(byte_buff);//test
    }
    catch (error) {
        console.log(error.message);
    }

}

/**
 * Reads cloner's characterisitcs via button push.
 * @returns {Promise<void>} A promise that resolves when the data is received from the cloner.
 */
async function receive_data_from_cloner() {

    //read cloner characteristic
    cloner_to_web_data = await cloner_transmit_characteristic.readValue();

    let val = decoder.decode(cloner_to_web_data);
    console.log(val);
    //store new badge to local storage
    storeRFIDCode(val);
    

    console.log(localStorage.getItem('rfidCodes'));//test to see if storage works
    //localStorage.removeItem('rfidCodes');//test only!

}

/**
 * Sets up RFID cloner notification.
 * @returns {Promise<void>} A promise that resolves when the RFID cloner notification is set up.
 */
async function setup_RFID_notifications() {

    if (cloner_transmit_characteristic.properties.notify) {

        //get updated characteristic if notification received
        try {
            await cloner_transmit_characteristic.startNotifications();
        }
        catch (error) { 
            console.log("notifications not started!");
        }

        //add event listener to characteristic, then if notification change val
        cloner_transmit_characteristic.addEventListener(
            "characteristicvaluechanged",

            //aero function event listener activates when notification arrives
            async (event_handler) => {

                try {
                    let val = event_handler.target.value;
                    val = decoder.decode(val);
                    document.getElementById("RFID_Badge_number").innerHTML = val;
                    //store UID to JSON data
                    storeRFIDCode(val);
                    
                }
                catch (DOMException) {
                    console.log("notification failure.");
                 }

                console.log(localStorage.getItem('rfidCodes'));//TEST
                

            }
        )
    }
}

/**
 * Sends a command to the cloner to scan a badge.
 * @returns {Promise<void>} A promise that resolves when the command is sent to the cloner.
 */
async function cloner_command_scan() {

    try {
        //Cloner waits for data to arrive on this characteristic. Doesnt matter what the data is, just that it arrives.
        let data = encoder.encode("writetoRFID_");
        await cloner_scan_command_characteristic.writeValue(data);
    }
    catch (error) { 
        console.log("cloner command scan characteristic unreachable.");
    }
}

/**
 * Sends a command to turn off the cloner device.
 * @returns {Promise<void>} A promise that resolves when the command is sent to turn off the cloner.
 */
async function cloner_turn_off(){
    let data =  await encoder.encode("turnoffnow_");
    await cloner_turn_off_characteristic.writeValue(data);
}

/**
 * Clears JSON data from the web browser.
 * @returns {void}
 */
function clear_saved_data() {
    localStorage.removeItem("rfidCodes");
    console.log("cleared");
    //clear drop down list 
    update_badge_list()
}

/**
 * Function to store an RFID code in local storage.
 * Attempts to handle errors.
 * @param {string} code - The RFID code to store.
 * @returns {void}
 */
function storeRFIDCode(code) {
    let existingCodes;

    //retreive badge numbers from storage and put into array
    try {
        existingCodes = localStorage.getItem('rfidCodes')
        existingCodes = existingCodes ? JSON.parse(existingCodes) : [];
    }
    //if no list available, make new array
    catch (error) {
        existingCodes = []
    }

    //if new code not in list, add and save
    if (!existingCodes.includes(code)) {
        //add new code to the array of codes
        existingCodes.push(code);

        //save codes
        try {
            localStorage.setItem('rfidCodes', JSON.stringify(existingCodes));
        } catch (error) {

            console.error('Failed to save RFID code: ', error);
        }
        //update drop down list
        update_badge_list();
    }
    //badge in list already, ignore
    else {
        let message = "UID already in list!";
        console.log(message);
    }


}

/**
 * Retrieves all stored RFID codes from local storage.
 * Attempts to handles errors.
 * @returns {Array<string>} An array of stored RFID codes
 */
function retrieveAllCodes() {
    let existingCodes;

    try {
        if (typeof localStorage !== 'undefined') {
            existingCodes = localStorage.getItem('rfidCodes');
            existingCodes = existingCodes ? JSON.parse(existingCodes) : [];
        } else {
            existingCodes = []
        }
    } catch (error) {
        existingCodes = [];
        console.error('Failed to retrieve RFID codes: ', error);
    }

    return existingCodes
}



/**
 * Fills the badge list in the dropdown
 * @param {Array<string>} badges An array of badge numbers.
 * @param {HTMLSelectElement} select_list The HTML select element representing the dropdown.
 * @returns {void}
 */
function fill_badge_list(badges,select_list){
    
    //fill select list with new badges
    for(let i = 0;i<badges.length; i++){
        //new option for list (empty)
        let new_option = document.createElement("option");
        //fill option with data
        new_option.textContent = badges[i];
        new_option.value = badges[i];
        //add option to select list in HTML
        select_list.appendChild(new_option);
    }
}

/**
 * Clears the badge list in the dropdown menu.
 * @param {HTMLSelectElement} badge_list The HTML select element representign the dropdown menu.
 * @returns {void}
 */
function clear_badge_list(badge_list){
    let len = badge_list.options.length-1;
    //loop through drop down list and clear it
    for(let i = len; i>=0;i--){
        badge_list.remove(i);
    }
}

/**
 * Updates the badge list in the dropdown menu.
 * @returns {void}
 */
function update_badge_list(){
    //read badges from memory
    let badges = retrieveAllCodes();
    //dropdown menu from HTML
    let badge_list = document.getElementById("badges_list");
    //clear data
    clear_badge_list(badge_list);
    //refill with updated data
    fill_badge_list(badges, badge_list);
    console.log(badges);//test
}


/**
 * Fills the text box with the selection from the dropdown list.
 * @returns {void}
 */
function selection_to_text_box(){
    //HTML text box and drop down list
    let select_box = document.getElementById("badges_list");
    let text_box = document.getElementById("text_box");
    //take drop down list selection value and send to text box
    let selection = select_box.value;
    text_box.value = selection;
}
