/**
 * Loads and evaluates permissions of the current user
 *
 * @author  Bernhard Gessler
 * @version 1.1.0
 */
(function( $ ) {

    window.PermissionEntityEnum = {"None": 0, "Own":1, "Organization":2, "All":3};
    Object.freeze(PermissionEntityEnum);
    window.PermissionKindEnum = {"Default":1, "Ongoing":2, "Full":3};
    Object.freeze(PermissionKindEnum);    

    window.tglUserPermission = new function() {

        this.CurrentUserId;
        this.CurrentUserOrganizationId;

        this.PermissionCreateEntity;
        this.PermissionReadEntity;
        this.PermissionUpdateEntity;
        this.PermissionUpdateKind;
        this.PermissionDeleteEntity;
        this.PermissionDeleteKind;

        this.Load = function(callbackSuccess, callbackFailed) {

            // By default we load the currently logged in user
            var currentUserId = firebase.auth().currentUser.uid;

            // But we can override that by URL parameter
            var impersonateUserId = getUrlParamByName('impersonateUser');
            if(impersonateUserId) {
                currentUserId = impersonateUserId;
            }

            // Remember for later
            tglUserPermission.CurrentUserId = currentUserId;

            // Load from local storage, if we have buffered the user there
            if(localStorage["tgl_user_" + currentUserId]){
                var user = JSON.parse(localStorage["tgl_user_" + currentUserId]);
                parseUser(user);
                if(callbackSuccess) callbackSuccess();

                // Even though we loaded the localy buffered user and are good to go
                // let's download the user again and update our buffer.
                // So next time we load the page we have an up-to-date user.
                setTimeout(function(){ 
                    loadUser(currentUserId);
                 }, 1000);

            } else{

                // Nothing buffered locally. Load and return user.
                loadUser(currentUserId, callbackSuccess, callbackFailed)
            }
        }

        function loadUser(userId, callbackSuccess, callbackFailed){
            firebase.database().ref('/users/' + userId).once('value').then(function(snapshotUser) {

                // Interpret all permissions
                var user = snapshotUser.val();
                parseUser(user);

                // Save for later                
                localStorage.setItem("tgl_user_" + userId, JSON.stringify(user));

                if(callbackSuccess) callbackSuccess();

            }, function (error) {                
                if(callbackFailed) callbackFailed(error);
            });
        }

        function parseUser(user) {
            
            // Remember for later            
            tglUserPermission.CurrentUserOrganizationId = user.organizationId;

            // Parse Permissions
            var permissions = user.scopes;

            // Check if the user can create bookings
            if(permissions.hasOwnProperty("booking_all_create")) {                    
                tglUserPermission.PermissionCreateEntity = PermissionEntityEnum.All;

            } else if(permissions.hasOwnProperty("booking_organization_create")) {                    
                tglUserPermission.PermissionCreateEntity = PermissionEntityEnum.Organization;

            } else if(permissions.hasOwnProperty("booking_own_create")) {
                tglUserPermission.PermissionCreateEntity = PermissionEntityEnum.Own;

            } else {
                tglUserPermission.PermissionCreateEntity = PermissionEntityEnum.None;
            }


            // Check if the user can read bookings
            if(permissions.hasOwnProperty("booking_all_read")) {                    
                tglUserPermission.PermissionReadEntity = PermissionEntityEnum.All;

            } else if(permissions.hasOwnProperty("booking_organization_read")) {                    
                tglUserPermission.PermissionReadEntity = PermissionEntityEnum.Organization;

            } else if(permissions.hasOwnProperty("booking_own_read")) {
                tglUserPermission.PermissionReadEntity = PermissionEntityEnum.Own;

            } else {
                tglUserPermission.PermissionReadEntity = PermissionEntityEnum.None;
            }


            // Check if the user can update bookings
            if(permissions.hasOwnProperty("booking_all_updatefull")) {
                // Full Admin
                // Can change pax details, itinerary in the future or past
                // Can change booking before, during and after the trip is over                
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionUpdateKind = PermissionKindEnum.Full;

            } else if(permissions.hasOwnProperty("booking_all_updateongoing")) {
                // Country manager 
                // Can change pax details
                // Can update future weeks of booking during the trip
                // Can not modify the past or the credit                 
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionUpdateKind = PermissionKindEnum.Ongoing;

            } else if(permissions.hasOwnProperty("booking_all_update")) {
                // Not sure yet if this is a use case
                // Potentially marketing
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionUpdateKind = PermissionKindEnum.Default;

            } else if(permissions.hasOwnProperty("booking_organization_update")) {
                // Agent user with access to bookings made by his organization
                // Can update itinerary until organization wide cancellation deadline
                // Can update pax details until program start
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.Organization;
                tglUserPermission.PermissionUpdateKind = PermissionKindEnum.Default;

            } else if(permissions.hasOwnProperty("booking_own_update")) {
                // Agent user with access to bookings made by himself
                // Can update itinerary until organization wide cancellation deadline
                // Can update pax details until program start
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.Own;
                tglUserPermission.PermissionUpdateKind = PermissionKindEnum.Default;

            } else {
                // No relevant permission found
                tglUserPermission.PermissionUpdateEntity = PermissionEntityEnum.None;
            }


            // Check if the user can delete bookings
            if(permissions.hasOwnProperty("booking_all_deletefull")) {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionDeleteKind = PermissionKindEnum.Full;

            } else if(permissions.hasOwnProperty("booking_all_deleteongoing")) {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionDeleteKind = PermissionKindEnum.Ongoing;

            } else if(permissions.hasOwnProperty("booking_all_delete")) {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.All;
                tglUserPermission.PermissionDeleteKind = PermissionKindEnum.Default;

            } else if(permissions.hasOwnProperty("booking_organization_delete")) {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.Organization;
                tglUserPermission.PermissionDeleteKind = PermissionKindEnum.Default;

            } else if(permissions.hasOwnProperty("booking_own_delete")) {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.Own;
                tglUserPermission.PermissionDeleteKind = PermissionKindEnum.Default;

            } else {
                tglUserPermission.PermissionDeleteEntity = PermissionEntityEnum.None;
            }
        }
    }
}( jQuery ));