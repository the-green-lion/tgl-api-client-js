/**
 * Loads and evaluates permissions of the current user
 *
 * @author  Bernhard Gessler
 * @version 1.1.6
 */
(function( $ ) {

    window.PermissionLevelEnum = {"None": 0, "Own":1, "Organization":2, "All":3};
    Object.freeze(PermissionLevelEnum);

    window.tglUserPermission = new function() {

        this.CurrentUserId;
        this.CurrentUserOrganizationId;

        this.create = new function() {
            this.Level = PermissionLevelEnum.None;
            this.Full = false;
            this.Before = false;
            this.During = false;
            this.After = false;
        };

        this.read = new function() {
            this.Level = PermissionLevelEnum.None;
            this.Full = false;
            this.Before = false;
            this.During = false;
            this.After = false;
        };

        this.update = new function() {
            this.Level = PermissionLevelEnum.None;
            this.Full = false;
            this.Before = false;
            this.During = false;
            this.After = false;
        };

        this.delete = new function() {
            this.Level = PermissionLevelEnum.None;
            this.Full = false;
            this.Before = false;
            this.During = false;
            this.After = false;
        };

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
            var currentScopes = Object.keys(permissions).filter((key) => permissions[key]);

            parseBookingPermissions(currentScopes, "create");
            parseBookingPermissions(currentScopes, "read");
            parseBookingPermissions(currentScopes, "update");
            parseBookingPermissions(currentScopes, "delete");
        }

        function parseBookingPermissions(currentScopes, action)
        {
            // Step 1: Check which booking the user is allowed to access
            if (currentScopes.some(s => s.startsWith("booking_all_" + action + "_"))) {
                // Global access
                tglUserPermission[action].Level = PermissionLevelEnum.All;

            } else if (currentScopes.some(s => s.startsWith("booking_custom_" + action + "_"))) {
                // Global access with a custom restriction.            
                tglUserPermission[action].Level = PermissionLevelEnum.All;

            } else if (currentScopes.some(s => s.startsWith("booking_organization_" + action + "_"))) {
                tglUserPermission[action].Level = PermissionLevelEnum.Organization;

            } else if (currentScopes.some(s => s.startsWith("booking_own_" + action + "_"))) {
                tglUserPermission[action].Level = PermissionLevelEnum.Own;
            }
            //else if (bookingId.ToString() == currentSession.CurrentUserId)
            //{
            //    // Participant updates his/her own booking
            //    filterUserId = null;
            //    filterOrganizationId = null;
            //}
            else {
                tglUserPermission[action].Level = PermissionLevelEnum.None;
                return;
            }


            // Step 2: Check when the user is allowed to access these bookings
            if (currentScopes.some(s => s.startsWith("booking_") && s.endsWith("_" + action + "_full")))
            {
                // Unrestricted access. We don't need to worry about cancellation limits.
                tglUserPermission[action].Full = true;
                tglUserPermission[action].Before = true;
                tglUserPermission[action].During = true;
                tglUserPermission[action].After = true;
            }
            else
            {
                if (currentScopes.some(s => s.startsWith("booking_") && s.endsWith("_" + action + "_before")))
                {
                    tglUserPermission[action].Before = true;
                }
                if (currentScopes.some(s => s.startsWith("booking_") && s.endsWith("_" + action + "_during")))
                {
                    tglUserPermission[action].During = true;
                }
                if (currentScopes.some(s => s.startsWith("booking_") && s.endsWith("_" + action + "_after")))
                {
                    tglUserPermission[action].After = true;
                }
            }
        }
    }
}( jQuery ));