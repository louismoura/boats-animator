module.exports = {};

/** A class for project preferences. */
(function () {
  "use strict";

  /**
   * Constructor for Preference.
   */
  function Preference() {
  }

  Preference.prototype = {
    constructor: Preference,

    /** Get a html select with a list of available webrtc devices */
    getAvailableDevices: function() {
      return new Promise(function(resolve) {
        // Get WebRTC video devices
        navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
          devices = devices.filter(device => device.kind === "videoinput");

          // create html
          var deviceChooser = window.document.createElement("select");
          deviceChooser.setAttribute("name", "deviceChooser")

          devices.forEach(function(source, i) {
            // Get the proper camera name
            let cameraName = `Camera #${i + 1}`;
            if (source.label) {
              cameraName = source.label.substr(0, source.label.indexOf("(") - 1);
            }

            // Create the menu selection
            const option = window.document.createElement("option");
            option.text = cameraName;
            option.value = source.deviceId;
            deviceChooser.appendChild(option);
          })

          // Resolve promise with html of available devices
          resolve(deviceChooser);
        })
        .catch(function(err) {
          console.log(err.name + ": " + err.message);
        });
      });
    },

    /** Displays the preferences window */
    display: async function() {
      var deviceHTML = await this.getAvailableDevices();

      // Create the popup window
      var prefWindow = window.document.createElement("form");
      prefWindow.innerHTML += "<label for=\"deviceChooser\">Camera source:</label><br>";
      prefWindow.innerHTML += deviceHTML.outerHTML;

      const {value: formValues} = await Swal({
        title: 'Preferences',
        html: prefWindow.outerHTML,
        allowOutsideClick: false,
        allowEscapeKey: false,

        focusConfirm: false,
        preConfirm: () => {
          return [
            document.getElementById("prefDeviceChooser").value
          ]
        }
      })

      //
      if (formValues) {
        Swal(formValues);
      }
    }
  };

  // Public exports
  module.exports = Preference;
}());