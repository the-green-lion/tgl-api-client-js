/**
 * Javascript client for TGL's REST API.
 *
 * @author  Bernhard Gessler
 * @version 1.0.0
 */
var tglApiClient = new function() {
    // Variables
    var currentUser = null;
    
    // Initialize Firebase
    var config = {
        authDomain: 'identity.thegreenlion.net',
        apiKey: "AIzaSyC5Fw0sHmxEg7-S1iylkQ68WN6X2rlGq8M",
        databaseURL: "https://tgl-api-20e32.firebaseio.com"
    };
    firebase.initializeApp(config);

    this.endpointBaseUrl = "https://api.thegreenlion.net/";
    this.shallowMode = true;

    // Accept empty responses as valid JSON
    // https://github.com/jquery/jquery/issues/3973
    jQuery.ajaxSetup({
        converters: {
            "text json" : function(response) {
                return (response == "") ? null : JSON.parse(response);
            },
        },
    });

    this.refresh = function(callbackSuccess, callbackFailed){
        
        // If we manually modify the auth state in the local storage
        // Firebase will not reload by itself. So we can use this
        // method to kill it and initialize it again.        
        firebase.app().delete().then(function() {
            currentUser = null;
            firebase.initializeApp(config);
            
            // Our onAuthStateChanged observer that we created before doesn't work anymore after we deleted the app.
            // Lets make a new one and run it once so we only call our success handler once we actually loaded the login
            var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {
                unsubscribe();

                if (user) {
                    currentUser = user;
                    if (callbackSuccess) callbackSuccess();
                } else {
                    if (callbackFailed) callbackFailed();
                }
            });
        }, function(){
            if (callbackFailed) callbackFailed();
        });
    }

    // --------------
    // AUTH
    // --------------
    this.auth = new function()
    {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                currentUser = user;
            } else {
                currentUser = null;
            }
        });
      
        this.signInWithEmailAndPassword = function(email, secret, callbackSuccess, callbackFailed) {
            var key = encodeURIComponent(email);
            this.signIn(key, secret, callbackSuccess, callbackFailed);
        }
             
        this.signIn = function(key, secret, callbackSuccess, callbackFailed) {
            var unsubscribe = firebase.auth().onAuthStateChanged(function(user) {

                // Unsubscribe of the event immediately. We only want to see once if we're logged in or not.
                unsubscribe();

                // If user exists we are logged in. But maybe as an another user.
                // Compare user ID (API key) and login again if wrong user.
                if (user && user.uid == key) {
                    //console.log("Already logged in.");
                    if (callbackSuccess) callbackSuccess();
                    
                } else {
                    jQuery.ajax({
                        type: "GET",
                        url: tglApiClient.endpointBaseUrl + "auth/user/" + key + "/authenticate?secret=" + secret,
                        contentType: "application/json; charset=utf-8",
                        dataType: "json",
                        success: function (response) {
                            //console.log("API login successfull");

                            firebase.auth().signInWithCustomToken(response.token)
                            .then(function(userCredential) {
                                //console.log("Firebase login successfull");
                                currentUser = userCredential.user;
                                if (callbackSuccess) callbackSuccess();

                            }, function(error) {
                                if (callbackFailed) callbackFailed(error);
                            });
                            
                        }, error: function (error) {
                            //console.log("Failed obtaining token");
                            if (callbackFailed) callbackFailed(error);
                        }
                    });
                }
            });                        
        }

        // Get the current firebase token
        this.getToken = function(callbackSuccess, callbackFailed) {
            if (currentUser == null) {
                // We're not logged in
                if (callbackFailed) callbackFailed();
                return;
            }

            // Logged in. Now get the token
            currentUser.getIdToken(false).then(function(idToken) {
                if (callbackSuccess) callbackSuccess(idToken);              
  
            }).catch(function(error) {
              if (callbackFailed) callbackFailed(error);
            });
        }

        
    }

    // --------------
    // ADMIN
    // --------------
    this.admin = new function()
    {
        this.changePassword = function(currentPassword, newPassword, callbackSuccess, callbackFailed) {
            // Call the TGL authentication server 
            var token = currentUser.getIdToken(false).then(function(idToken) {
                
                jQuery.ajax({
                    type: "POST",
                    url: tglApiClient.endpointBaseUrl + "admin/user/me/secret/change?currentsecret=" + currentPassword + "&newsecret=" + newPassword + "&auth=" + idToken,
                    //dataType: "json",
                    success: callbackSuccess,
                    error: callbackFailed
                });

            }).catch(function(error) {
                if (callbackFailed) callbackFailed(error);
            });
        }

        this.resetPassword = function(callbackSuccess, callbackFailed) {
            // Call the TGL authentication server 
            var token = currentUser.getIdToken(false).then(function(idToken) {
                
                jQuery.ajax({
                    type: "POST",
                    url: tglApiClient.endpointBaseUrl + "admin/user/me/secret/reset?&auth=" + idToken,
                    dataType: "json",
                    success: callbackSuccess,
                    error: callbackFailed
                });

            }).catch(function(error) {
                if (callbackFailed) callbackFailed(error);
            });
        }
    }
    
    
    // --------------
    // CONTENT API
    // --------------
    this.content = new function()
    {
        // Get the IDs of all contacts
        this.listContacts = function(callbackSuccess, callbackFailed, editedAfter = null) {
            this.listDocuments("contacts", callbackSuccess, callbackFailed, editedAfter);
        }

        // Get the IDs of all contacts fulfilling a certain criteria
        this.queryContacts = function(indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter = null) {
            this.queryDocuments("contacts", indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter);
        }
        
        // Get a specific contacts doc by its ID
        this.getContact = function(id, callbackSuccess, callbackFailed) {
            this.getDocument(id, callbackSuccess, callbackFailed);
        }
        
        
        // Get the IDs of all countries
        this.listCountries = function(callbackSuccess, callbackFailed, editedAfter = null) {
            this.listDocuments("country", callbackSuccess, callbackFailed, editedAfter);
        }

        // Get the IDs of all countriesfulfilling a certain criteria
        this.queryCountries = function(indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter = null) {
            this.queryDocuments("country", indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter);
        }
        
        // Get a specific country by its ID
        this.getCountry = function(id, callbackSuccess, callbackFailed) {
            this.getDocument(id, callbackSuccess, callbackFailed);
        }
        
             
        // Get the IDs of all locations
        this.listLocations = function(callbackSuccess, callbackFailed, editedAfter = null) {
            this.listDocuments("location", callbackSuccess, callbackFailed, editedAfter);
        }

        // Get the IDs of all locations fulfilling a certain criteria
        this.queryLocations = function(indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter = null) {
            this.queryDocuments("location", indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter);
        }
        
        // Get a specific location by its ID
        this.getLocation = function(id, callbackSuccess, callbackFailed) {
            this.getDocument(id, callbackSuccess, callbackFailed);
        }

        
        // Get the IDs of all programs
        this.listPrograms = function(callbackSuccess, callbackFailed, editedAfter = null) {
            this.listDocuments("program", callbackSuccess, callbackFailed, editedAfter);
        }

        // Get the IDs of all programs fulfilling a certain criteria
        this.queryPrograms = function(indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter = null) {
            this.queryDocuments("program", indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter);
        }
        
        // Get a specific program by its ID
        this.getProgram = function(id, callbackSuccess, callbackFailed) {
            this.getDocument(id, callbackSuccess, callbackFailed);          
        }
        
        /* ==================================
            GENERIC METHODS
           ================================== */
        
        // Get the IDs of all documents of a type
        this.listDocuments = function(documentType, callbackSuccess, callbackFailed, editedAfter = null) {
            tglApiClient.content.queryDocuments(documentType, "id", "all", callbackSuccess, callbackFailed, editedAfter);            
        }

        // Get the IDs of all documents of a type fulfilling a certain criteria
        this.queryDocuments = function(documentType, indexBy, indexValue, callbackSuccess, callbackFailed, editedAfter = null) {
            firebase.database().ref('/users/' + currentUser.uid).once('value').then(function(snapshotUser) {

                var query= firebase.database().ref('/content_index/' + snapshotUser.val().organizationId + '/' + documentType + "_by_" + indexBy + "/" + indexValue);
                if(editedAfter != null){
                    query = query.orderByValue().startAt(editedAfter.toJSON());
                }

                query.once('value').then(function(snapshot) {
                    var ids = [];
                    if(snapshot.exists()){
                        ids = Object.keys(snapshot.val());
                    }

                    if (callbackSuccess) callbackSuccess(ids);

                }, function(error) {
                    if (callbackFailed) callbackFailed(error);
                });
                
            }, function (error) {
                if (callbackFailed) callbackFailed(error);
            });
        }
        
        // Get a specific document by its ID
        this.getDocument = function(id, callbackSuccess, callbackFailed) {

            // Load full doc or shallow version?
            var documentId = id;
            if(tglApiClient.shallowMode) documentId += "_slim";

            getDocumentInternal(documentId, callbackSuccess, function(error, canRetry){
                if(tglApiClient.shallowMode && canRetry){
                    // Couldn't load the shallow doc. Try the full one.
                    getDocumentInternal(id, callbackSuccess, callbackFailed);
                }
            });
        }

        // Get a specific document by its ID
        function getDocumentInternal(id, callbackSuccess, callbackFailed) {
            firebase.database().ref('/content/' + id).once('value').then(function(snapshot) {

                // We have permission to access the doc but it doesn't exist
                if(!snapshot.exists()){
                    if (callbackFailed) callbackFailed("Document '" + id + "' doesn't exist", true);
                    return;
                }

                // All good
                if (callbackSuccess) callbackSuccess(snapshot.val());
                
            }, function(error) {

                // We probably don't have permission to access the doc
                // Could also be because the ID is invalid
                if (callbackFailed) callbackFailed(error, false);
            });
        }
    }
    

    // --------------
    // BOOKING API
    // --------------
    this.booking = new function()
    {
        //var urlBookingsUser = "https://api.thegreenlion.net/booking/user";
        //var urlBookingsOrganization = "https://api.thegreenlion.net/booking/organization";

        // Get all bookings matching certain criteria
        this.listBookingsOfUser = function(userId, filter, page, callbackSuccess, callbackFailed) {
            listBookings("user", userId, filter, page, callbackSuccess, callbackFailed);
        }

        this.listBookingsOfOrganization = function(organizationId, filter, page, callbackSuccess, callbackFailed) {
            listBookings("organization", organizationId, filter, page, callbackSuccess, callbackFailed);
        }

        function listBookings(entity, entityId, filter, page, callbackSuccess, callbackFailed) {
          var parameters = "&page=" + page;
          if (filter.hasOwnProperty('isCanceled')) parameters += "&iscanceled=" + filter.isCanceled;
          if (filter.hasOwnProperty('dateStartBefore')) parameters += "&dateStartBefore=" + filter.dateStartBefore;
          if (filter.hasOwnProperty('dateStartafter')) parameters += "&dateStartafter=" + filter.dateStartafter;
          if (filter.hasOwnProperty('reference')) parameters += "&reference=" + filter.reference;
          if (filter.hasOwnProperty('email')) parameters += "&email=" + filter.email;

          executeCall("GET", entity, entityId, '', parameters, null, callbackSuccess, callbackFailed);
        }

        // Get booking with specified id
        this.getBookingOfUser = function(userId, id, callbackSuccess, callbackFailed) {
          executeCall("GET", "user", userId, id, '', null, callbackSuccess, callbackFailed);
        }

        this.getBookingOfOrganization = function(organizationId, id, callbackSuccess, callbackFailed) {
            executeCall("GET", "organization", organizationId, id, '', null, callbackSuccess, callbackFailed);
        }

        this.getBookingGlobal = function(id, callbackSuccess, callbackFailed) {
            executeCall("GET", "all", '',  id, '', null, callbackSuccess, callbackFailed);
        }
        
        // Create new booking
        this.createBookingOfUser = function(userId, booking, callbackSuccess, callbackFailed) {
          executeCall("POST", "user", userId, '', '', booking, callbackSuccess, callbackFailed);
        }
        
        // Update booking with specified id
        this.updateBookingOfUser = function(userId, id, booking, callbackSuccess, callbackFailed) {
          executeCall("PUT", "user", userId, id, '', booking, callbackSuccess, callbackFailed);
        }
        
        this.updateBookingOfOrganization = function(organizationId, id, booking, callbackSuccess, callbackFailed) {
            executeCall("PUT", "organization", organizationId, id, '', booking, callbackSuccess, callbackFailed);
        }

        this.updateBookingGlobal = function(id, booking, callbackSuccess, callbackFailed) {
            executeCall("PUT", "all", '',  id, '', booking, callbackSuccess, callbackFailed);
        }
        
        // Cancel booking with specified id
        this.cancelBookingOfUser = function(userId, id, callbackSuccess, callbackFailed) {
          executeCall("DELETE", "user", userId, id, '', null, callbackSuccess, callbackFailed);          
        }

        this.cancelBookingOfOrganization = function(organizationId, id, callbackSuccess, callbackFailed) {
            executeCall("DELETE", "organization", organizationId, id, '', null, callbackSuccess, callbackFailed);          
        }

        this.cancelBookingGlobal = function(id, callbackSuccess, callbackFailed) {
            executeCall("DELETE", "all", '',  id, '', null, callbackSuccess, callbackFailed);          
        }
        
        /* ==================================
            GENERIC METHODS
           ================================== */

        // Call the TGL bookings server 
        function executeCall(command, entity, entityId, id, parameters, booking, callbackSuccess, callbackFailed) {
          var token = currentUser.getIdToken(false).then(function(idToken) {

            jQuery.ajax({
              type: command,
              url: tglApiClient.endpointBaseUrl + "booking/" + entity + (entityId != '' ? "/" + entityId : '') + "/bookings" + (id != '' ? "/" + id : '') + "?auth=" + idToken + parameters,
              data: JSON.stringify(booking),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              success: callbackSuccess,
              error: callbackFailed
            });

          }).catch(function(error) {
            if (callbackFailed) callbackFailed(error);
          });
        }
    }
}