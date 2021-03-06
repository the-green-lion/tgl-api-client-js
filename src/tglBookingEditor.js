/**
 * Allows to load, display, modify and save bookings
 *
 * @author  Bernhard Gessler
 * @version 1.3.3
 */
(function( $ ) {

    window.tglBookingEditor = new function() {
        // --------------
        // ENUMS
        // --------------
        // var EntityEnum = {"Own":1, "Organization":2, "All":3};
        // Object.freeze(EntityEnum);

        // --------------
        // PUBLIC VARIABLES
        // --------------
        this.Booking = {};
        this.BookingUnmodified = {};
        this.FirstEditableWeek = null;

        // --------------
        // PRIVATE VARIABLES
        // --------------
        var isEditable = true;
        var isItineraryEditable = true;
        var isCancelable = true;
        var localDateStart = null;
        var timerRefreshHistory = null;
        
        // --------------
        // PRECOMPILED HANDLEBARS TEMPLATES
        // --------------
        var templateProgram;
        var templateHistory;

        // --------------
        // OPTIONS
        // --------------
        this.Options = new function() {
            this.BookingId = "";
            
            // this.CurrentEntity = EntityEnum.Own;
            this.UserId = null;
            this.UserOrganizationId = null;

            this.EditDeadlineDays = -4;
            this.AllowEditBeforeTrip = false;
            this.AllowEditDuringTrip = false;
            this.AllowEditAfterTrip = false;
            this.AllowCancelBeforeTrip = false;
            this.AllowCancelDuringTrip = false;
            this.AllowCancelAfterTrip = false;
            this.AllowAddCredit = false;

            this.StartDayOfWeek = 1;

            this.MaintainCredit = true;

            this.FieldContainer;
            this.ItineraryContainer;
            this.ItineraryContainerNonEditable;
            this.ItineraryContainerEditable;
            this.HistoryContainer = null;
            this.WelcomeNote;
            this.TemplateProgram;
            this.TemplateHistory = null;

            this.CallbackProgramChange;
            this.CallbackItineraryUpdated;
            this.CallbackCriticalError;
        }
        
        this.Init = function() {
            if(this.Options.TemplateProgram != null){
                var sourceProgram = this.Options.TemplateProgram.html();            
                templateProgram = Handlebars.compile(sourceProgram);
            }

            if(this.Options.TemplateHistory != null){
                var sourceHistory = this.Options.TemplateHistory.html();
                templateHistory = Handlebars.compile(sourceHistory);
            }
        }

        this.CreateBooking = function(callbackSuccess, callbackFailed) {

            // Assume a starting date and set it to UTC 0
            var newStartingDate = new Date().addDays(60);
            newStartingDate.setDate(newStartingDate.getDate() + (1 + 7 - newStartingDate.getDay()) % 7);
            newStartingDate.setMinutes(-newStartingDate.getTimezoneOffset());

            // Remember for later        
            tglBookingEditor.Booking = {
                "bookingId":96990,
                "isCanceled":false,
                "dateStart":newStartingDate.toJSON(),
                "dateArrival":null,
                "participant":{
                    "firstName":"",
                    "lastName":"",
                    "gender":null,
                    "passportNumber":"",
                    "birthday":"",
                    "countryCode":""
                },
                "programs":[],
                "fees":[]
            };

            // Keep a copy of the unmodified booking
            // Later on we can use that to compare the draft with the latest saved version
            tglBookingEditor.BookingUnmodified = tglBookingEditor.Booking;
            
            // Adjust the booking start date to the local start date setting
            // This could vary country by country
            localDateStart = new Date(tglBookingEditor.Booking.dateStart).addDays(tglBookingEditor.Options.StartDayOfWeek - 1);
            localDateStart.setHours(0,0,0,0);

            // We can't cancel a booking that hasn't even been created
            isCancelable = false;

            if(callbackSuccess) callbackSuccess(isEditable, isItineraryEditable, isCancelable);            
        }
        
        this.LoadBooking = function(callbackSuccess, callbackFailed) {


            tglApiClient.booking.getBooking(tglBookingEditor.Options.BookingId, bookingLoaded, callbackFailed);

            function bookingLoaded(booking) {

                // Remember for later        
                tglBookingEditor.Booking = booking;

                // Keep a copy of the unmodified booking
                // Later on we can use that to compare the draft with the latest saved version
                tglBookingEditor.BookingUnmodified = clone(booking);
                
                // Adjust the booking start date to the local start date setting
                // This could vary country by country
                localDateStart = new Date(tglBookingEditor.Booking.dateStart).addDays(tglBookingEditor.Options.StartDayOfWeek - 1);
                localDateStart.setMinutes(localDateStart.getMinutes() + localDateStart.getTimezoneOffset());

                // Check if the booking is cancelled. In this case it can't be edited anymore.
                if(booking.isCanceled){
                    isEditable = false;
                    isItineraryEditable = false;
                    isCancelable = false;
                }

                // Check if the user can edit the booking as the current point of time
                var dateArrival = localDateStart.addDays(-1);
                var dateDeparture = dateArrival.addDays(tglBookingEditor.Booking.programs.length * 7 -1);
                var today = new Date();

                if(today < dateArrival && !tglBookingEditor.Options.AllowEditBeforeTrip) {
                    isEditable = false;
                } else if(today >= dateArrival && today <= dateDeparture && !tglBookingEditor.Options.AllowEditDuringTrip) {
                    isEditable = false;
                } else if(today > dateDeparture && !tglBookingEditor.Options.AllowEditAfterTrip) {
                    isEditable = false;
                }

                if(today < dateArrival && !tglBookingEditor.Options.AllowCancelBeforeTrip) {
                    isCancelable = false;
                } else if(today >= dateArrival && today <= dateDeparture && !tglBookingEditor.Options.AllowCancelDuringTrip) {
                    isCancelable = false;
                } else if(today > dateDeparture && !tglBookingEditor.Options.AllowCancelAfterTrip) {
                    isCancelable = false;
                }

                // If we can't edit the booking, disable all fields
                if(!isEditable && tglBookingEditor.Options.FieldContainer){
                    tglBookingEditor.Options.FieldContainer.find("input").prop( "disabled", true );
                    tglBookingEditor.Options.FieldContainer.find("select").prop( "disabled", true );
                    tglBookingEditor.Options.FieldContainer.find("textarea").prop( "disabled", true );
                }

                // If we are only allowed to edit the booking before arrival, we need to consider the organization specific cancellation deadline
                if(tglBookingEditor.Options.AllowEditBeforeTrip && !tglBookingEditor.Options.AllowEditDuringTrip && !tglBookingEditor.Options.AllowEditAfterTrip){
                    
                    // Load the organization doc of the organization that made the booking
                    getOrganization(booking.organizationId, function(organizationDoc){
                        setEditability(organizationDoc.invoicing.cancellationPeriod.value);
                    }, callbackFailed);
                } else{

                    // We're still allowed to edit the booking later on so we set no cancellation period
                    setEditability(0);
                }

                function setEditability(cancellationPeriod){
                    // Once the cancellation period passed, the partner can still modify the pax details but not anymore the itinerary, start date.
                    // Also no more cancellations.
                    var dateCancellationLimit = localDateStart.addDays(-cancellationPeriod);

                    // If we're past the cancellation period and have no further editing capabilities, we can't modify the itinerary anymore
                    isItineraryEditable = isEditable;                    
                    if(today >= dateCancellationLimit && !tglBookingEditor.Options.AllowEditDuringTrip && !tglBookingEditor.Options.AllowEditAfterTrip) {
                        isItineraryEditable = false;
                        isCancelable = false;
                    }

                    if(!isItineraryEditable && tglBookingEditor.Options.ItineraryContainer) {
                        tglBookingEditor.Options.ItineraryContainer.addClass("readonly");
                    }

                    if(callbackSuccess) callbackSuccess(isEditable, isItineraryEditable, isCancelable);
                }
            }

            function getOrganization(organizationId, callbackSuccess, callbackFailed){
                // Load from local storage, if we have buffered the organization there
                if(localStorage["tgl_organization_" + organizationId]){
                    var organization = JSON.parse(localStorage["tgl_organization_" + organizationId]);
                    if(callbackSuccess) callbackSuccess(organization);

                    // Even though we loaded the localy buffered organization and are good to go
                    // let's download the organization again and update our buffer.
                    // So next time we load the page we have an up-to-date user.
                    setTimeout(function(){ 
                        loadOrganization(organizationId);
                    }, 1000);

                } else{

                    // Nothing buffered locally. Load and return organization.
                    loadOrganization(organizationId, callbackSuccess, callbackFailed)
                }
            }

            function loadOrganization(organizationId, callbackSuccess, callbackFailed){
                // Load the organization doc of the organization that made the booking
                tglApiClient.content.getDocument(organizationId, function(organizationDoc){

                    // Save for later                
                    localStorage.setItem("tgl_organization_" + organizationId, JSON.stringify(organizationDoc));
                    if(callbackSuccess) callbackSuccess(organizationDoc);

                }, callbackFailed);
            }
        }

        this.SaveBooking = function(callbackSuccess, callbackFailed) {
            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isEditable){
                return;
            }

            // If the user can't add credit to the booking, we can only save if we have enough credit already
            if(!tglBookingEditor.Options.AllowAddCredit) {
                
                // Check if we have enough credit
                var totalAmount = tglBookingEditor.GetTotalAmount();
                var totalCredit = tglBookingEditor.GetTotalCredit();
                if(totalAmount > totalCredit){
                    if(callbackFailed) callbackFailed("Not enough credit");
                    return;
                }
            }

            if(tglBookingEditor.Options.BookingId != null) {

                // Edit an existing booking
                tglApiClient.booking.updateBooking(tglBookingEditor.Booking.bookingId, tglBookingEditor.Booking, function(){

                    tglBookingEditor.BookingUnmodified = clone(tglBookingEditor.Booking);

                    if(callbackSuccess) callbackSuccess();

                }, callbackFailed);                

            } else {

                // Create a new booking
                tglApiClient.booking.createBooking(tglBookingEditor.Booking, tglBookingEditor.Options.UserId, callbackSuccess, callbackFailed);
            }
        }

        this.CancelBooking = function(callbackSuccess, callbackFailed){
            // Check if booking is loaded and can e cancelled
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isCancelable){
                return;
            }

            tglApiClient.booking.cancelBooking(tglBookingEditor.Booking.bookingId, callbackSuccess, callbackFailed);
        }

        this.AddProgram = function(id){
            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isItineraryEditable){
                return;
            }

            tglBookingEditor.Booking.programs.push({ id: id, price: 7 }); //TODO
            var html = createItineraryItem(tglBookingEditor.Booking.programs.length - 1, id);
            this.Options.ItineraryContainerEditable.append(html);
            html.addClass("hoverable");

            if (tglBookingEditor.Booking.programs.length > 0) {
                this.Options.WelcomeNote.hide();
            }

            updatePrices();
        }

        this.ChangeProgram = function(index, id){

            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isItineraryEditable){
                return;
            }

            // Check params
            if(isNaN(index) ||  index < 0 || index >= tglBookingEditor.Booking.programs.length){
                return;
            }

            tglBookingEditor.Booking.programs[index] = { id: id, price: tglBookingEditor.GetQuote(id) };
            var html = createItineraryItem(index, id);
            $(tglBookingEditor.Options.ItineraryContainer.find(".type-program:not(.removing)")[index]).replaceWith(html);
            html.addClass("hoverable");

            updatePrices();
        }

        this.RemoveProgram = function(index){

            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isItineraryEditable){
                return;
            }

            // Check params
            if(isNaN(index) ||  index < 0 || index >= tglBookingEditor.Booking.programs.length){
                return;
            }

            tglBookingEditor.Booking.programs.splice(index, 1);
            //$(tglBookingEditor.Options.Container.find(".type-program")[index]).remove();
            $(tglBookingEditor.Options.ItineraryContainer.find(".type-program:not(.removing)")[index])
                .addClass("removing")
                .animate({
                    height: 0,
                    opacity: 0
                }, {
                    duration:300,
                    complete: function(){
                        $(this).remove();
                    }
                });

            if (tglBookingEditor.Booking.programs.length == 0) {
                this.Options.WelcomeNote.show();
            }

            updatePrices();
        }

        this.AdjustFeeOnsitePayment = function(adjustmentAmount){
            adjustFee("onsite-payment", adjustmentAmount);
        }

        this.AdjustFeeDiscount = function(adjustmentAmount){
            adjustFee("Discount", adjustmentAmount);
        }

        this.AdjustFeeRefund = function(adjustmentAmount){
            adjustFee("Refund", adjustmentAmount);
        }

        function adjustFee(feeName, adjustmentAmount){

            // Check invoice amount after discunt and refund
            var totalAmount = tglBookingEditor.GetTotalAmount();
            var totalCredit = tglBookingEditor.GetTotalCredit();
            var amountOnSite = -tglBookingEditor.GetFeeAmount("onsite-payment");
            var amountDiscount = -tglBookingEditor.GetFeeAmount("Discount");
            var amountRefund = -tglBookingEditor.GetFeeAmount("Refund");
            var amountInvoice = Math.max(totalCredit, totalAmount) - amountOnSite - amountDiscount - amountRefund;
            
            if(tglBookingEditor.GetInvoiceAmount() <= 0 && adjustmentAmount > 0 && feeName != "onsite-payment"){
                // Invoice amount can't get negative
                return;
            }
    
            // Find current on-site payment amount
            var indexFee = tglBookingEditor.Booking.fees.findIndex(function(x) { return x.sku == feeName });
            var currentQuantity = 0;
            if(indexFee >= 0){
                currentQuantity = tglBookingEditor.Booking.fees[indexFee].quantity;
            }
    
            var newQuantity = currentQuantity + adjustmentAmount;
            if(newQuantity < 0) newQuantity = 0;
    
            // Update booking
            if(newQuantity == 0 && indexFee >= 0) {
    
                // We used to have unused points in here but don't need them anymore
                tglBookingEditor.Booking.fees.splice(indexFee, 1);
    
            } else if(newQuantity > 0 && indexFee >= 0){
    
                // We used to have unused points in here. Just update the quantity.
                tglBookingEditor.Booking.fees[indexFee].quantity = newQuantity;
    
            } else if(newQuantity > 0 && indexFee == -1){
    
                // We didn't have unused points before but need them now. Add them.
                tglBookingEditor.Booking.fees.push({sku: feeName, quantity: newQuantity, price: -1});
            }
    
            updatePrices();
        }

        this.GetFeeAmount = function(feeName){
            var indexFee = tglBookingEditor.Booking.fees.findIndex(function(x) { return x.sku == feeName });
            var feeAmount = 0;
            if(indexFee >= 0){
                feeAmount = tglBookingEditor.Booking.fees[indexFee].quantity * tglBookingEditor.Booking.fees[indexFee].price;
            }
    
            return feeAmount;
        }

        this.GetInvoiceAmount = function(){
            
            // Calculate invoice amount after cash pasyments, discount and refund
            var totalAmount = tglBookingEditor.GetTotalAmount();
            var totalCredit = tglBookingEditor.GetTotalCredit();
            var amountOnSite = -tglBookingEditor.GetFeeAmount("onsite-payment");
            var amountDiscount = -tglBookingEditor.GetFeeAmount("Discount");
            var amountRefund = -tglBookingEditor.GetFeeAmount("Refund");
            return Math.max(totalCredit, totalAmount) - amountOnSite - amountDiscount - amountRefund;
        }

        this.RefreshCredit = function(){
            updatePrices();
        }

        function updatePrices() {
            //TODO: Update price
            // We might have a program booked a long time ago before a price change
            // Then on site we added another week of the same program, at the current price
            // Now we remove the first week that came at a lower price
            // That lower price should now apply to the second week

            var programCount = [];

            for (var i = 0; i < tglBookingEditor.Booking.programs.length; i++) {

                var currentId = tglBookingEditor.Booking.programs[i].id;

                // Count how often we already had this program. Not necessarily consecutive.
                if (!programCount.hasOwnProperty(currentId)) {
                    programCount[currentId] = 0;
                }
                programCount[currentId]++;

                // Find the correct price for this week
                tglBookingEditor.Booking.programs[i].price = tglBookingEditor.GetQuote(currentId, programCount[currentId] - 1);
            }

            // Adjust unused points
            // If we use more points than we have, we set unused points to 0
            var totalAmount = tglBookingEditor.GetTotalAmount();
            var totalCredit = tglBookingEditor.GetTotalCredit();
            var unusedCredit = Math.max(totalCredit - totalAmount, 0);
            var indexUnusedCredit = tglBookingEditor.Booking.fees.findIndex(function(x) { return x.sku == "unused-points" });

            // If we decided not to keep unused points as available credit, remove them
            if(!tglBookingEditor.Options.MaintainCredit){
                unusedCredit = 0;
            }

            // Update booking
            if(unusedCredit == 0 && indexUnusedCredit >= 0) {

                // We used to have unused points in here but don't need them anymore
                tglBookingEditor.Booking.fees.splice(indexUnusedCredit, 1);

            } else if(unusedCredit > 0 && indexUnusedCredit >= 0){

                // We used to have unused points in here. Just update the quantity.
                tglBookingEditor.Booking.fees[indexUnusedCredit].quantity = unusedCredit;

            } else if(unusedCredit > 0 && indexUnusedCredit == -1){

                // We didn't have unused points before but need them now. Add them.
                tglBookingEditor.Booking.fees.push({sku: "unused-points", quantity: unusedCredit, price: 1});
            }

            if(tglBookingEditor.Options.CallbackItineraryUpdated) {
                tglBookingEditor.Options.CallbackItineraryUpdated();
            }
        }

        this.GetTotalAmount = function(){
            var excludedFees = ["unused-points", "onsite-payment", "Discount", "Refund"];
            var totalPrograms = tglBookingEditor.Booking.programs.reduce(function(a,b) { return a + b.price }, 0);
            var totalFees = tglBookingEditor.Booking.fees.filter(function(f) { return !excludedFees.includes(f.sku) }).reduce(function(a,b) { return a + (b.price * b.quantity) }, 0);

            return totalPrograms + totalFees;
        }

        this.GetTotalCredit = function(){

            if(!tglBookingEditor.Options.MaintainCredit){
                // If we decided not to keep unused points as available credit, don't count them
                return tglBookingEditor.GetTotalAmount();
            }

            var excludedFees = ["onsite-payment", "Discount", "Refund"];
            var totalProgramsCredit = tglBookingEditor.BookingUnmodified.programs.reduce(function(a,b) { return a + b.price }, 0);
            var totalFeesCredit = tglBookingEditor.BookingUnmodified.fees.filter(function(f) { return !excludedFees.includes(f.sku) }).reduce(function(a,b) { return a + (b.price * b.quantity) }, 0);

            var totalOnsitePayment = tglBookingEditor.BookingUnmodified.fees.filter(function(f) { return f.sku == "onsite-payment" }).reduce(function(a,b) { return a + (b.price * b.quantity) }, 0);
            var totalOnsitePaymentCurrent = tglBookingEditor.Booking.fees.filter(function(f) { return f.sku == "onsite-payment" }).reduce(function(a,b) { return a + (b.price * b.quantity) }, 0);

            return totalProgramsCredit + totalFeesCredit + totalOnsitePayment - totalOnsitePaymentCurrent;
        }

        this.GetQuote = function(newProgramId, count) {

            if (typeof count === 'undefined') count = null;

            // We want to add a new program to our itinerary and wonder how much that would cost
            // Possibly there was a price change since we made the booking
            // If so, we now charge the current price
            // But if we remove a program booked at a cheaper price from our trip, then add it back, this should come back at the old price

            // Check if booking is loaded
            if(!tglBookingEditor.Booking.hasOwnProperty("programs")){
                return;
            }

            var countOriginal = tglBookingEditor.BookingUnmodified.programs.filter(function(p) { return p.id == newProgramId }).length;
            var countModified = count != null ? count : tglBookingEditor.Booking.programs.filter(function(p) { return p.id == newProgramId }).length;
            if(countModified < countOriginal) {
                // We're just adding back a program that was there before
                // Get the original price
                return tglBookingEditor.BookingUnmodified.programs.filter(function(p) { return p.id == newProgramId }).map(function(p) { return p.price }).sort()[countModified];
            } else {
                // We added a program that was not there before or more weeks than there were before
                // We need to find out how much this program costs as of today

                var today = new Date();
                today.setHours(0,0,0,0);

                // Find the latest price that already applies
                var priceDates = Object.keys(tglContentBuffer.Buffer[newProgramId].price.prices);
                priceDates = priceDates.filter(function(x) { return new Date(x) <= today }).sort(function(a,b) { return new Date(a).getTime() - new Date(b).getTime() });
                var effectiveDate = priceDates[priceDates.length - 1];

                return tglContentBuffer.Buffer[newProgramId].price.prices[effectiveDate];
            }
        }
        
        this.PopulateItinerary = function(callbackSuccess, callbackFailed) {
            // Check if booking is loaded
            if(!tglBookingEditor.Booking.hasOwnProperty("programs")){
                return;
            }

            this.Options.ItineraryContainerNonEditable.empty();
            this.Options.ItineraryContainerEditable.empty();

            if (tglBookingEditor.Booking.programs.length > 0) {
                this.Options.WelcomeNote.hide();
            }
            
            for (var i = 0; i < tglBookingEditor.Booking.programs.length; i++) {

                var html = createItineraryItem(i, tglBookingEditor.Booking.programs[i].id);

                var currentWeekDate = localDateStart.addDays(i * 7);
                var dateLockEditing = currentWeekDate.addDays(tglBookingEditor.Options.EditDeadlineDays);
                if(new Date() > dateLockEditing || !isItineraryEditable) {
                    this.Options.ItineraryContainerNonEditable.append(html);
                } else {
                    this.Options.ItineraryContainerEditable.append(html);
                    html.addClass("hoverable");                

                    if(this.FirstEditableWeek == null) {
                        this.FirstEditableWeek = currentWeekDate;
                    }
                }            
            }      
        }

        function createItineraryItem(index, programId) {
            var currentProgram = tglContentBuffer.Buffer[programId];
            if(currentProgram === undefined){
                tglBookingEditor.Options.CallbackCriticalError("Couldn't load program '" + programId + "'");
                return;
            }

            var currentWeekDate = localDateStart.addDays(index * 7);            
            var context = {
                id: currentProgram.documentId,
                location: tglContentBuffer.GetProgramLocationString(currentProgram),
                country: currentProgram.country.name,
                imageUrl: currentProgram.media.images[0].sizes.find(function(elem) { return elem.size === "480, 360" }).url,
                title: currentProgram.documentName,
                price: tglBookingEditor.Booking.programs[index].price,
                dateStart: currentWeekDate.toLocaleDateString(),
                dateEnd: currentWeekDate.addDays(4).toLocaleDateString(),
                durationMin: currentProgram.availability.minDuration.value,
                durationMax: currentProgram.availability.maxDuration ? currentProgram.availability.maxDuration.value : null,
                ageMin: currentProgram.requirements.requirementMinimumAge ? currentProgram.requirements.requirementMinimumAge.value : null,
                ageMax: currentProgram.requirements.requirementMaximumAge ? currentProgram.requirements.requirementMaximumAge.value : null,
                sequenceNr: index
            };

            var html = $(templateProgram(context))/*[0]*/;
            //$(html).find(".card-date").text(currentWeekDate.toLocaleDateString());

            html.find(".action-change").click(function(e) {
                
                if (tglBookingEditor.Options.CallbackProgramChange){
                    var $card = $(this).closest(".card");
                    tglBookingEditor.Options.CallbackProgramChange($card.data("sequence-nr"), $card.data("id"), $card);
                }

                if(e) e.preventDefault();
            });

            html.find(".action-remove").click(function(e) {
                
                if (tglBookingEditor.Options.CallbackProgramChange){
                    var $card = $(this).closest(".card");
                    tglBookingEditor.RemoveProgram($card.data("sequence-nr"));
                    tglBookingEditor.ValidateItinerary();
                }

                if(e) e.preventDefault();
            });

            return html;
        }

        this.EnableDragDrop = function() {
            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isItineraryEditable){
                return;
            }

            var list = tglBookingEditor.Options.ItineraryContainerEditable[0];
            list.addEventListener('slip:beforewait', function(e){
                if (e.target.classList.contains('instant_drag')) e.preventDefault();
            }, false);
            list.addEventListener('slip:beforeswipe', function(e){
                // No swiping
                e.preventDefault();
            }, false);
            list.addEventListener('slip:afterswipe', function(e){
                e.target.parentNode.appendChild(e.target);
                setTimeout(tglBookingEditor.ValidateItinerary, 100);
            }, false);
            list.addEventListener('slip:reorder', function(e){
                e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);

                // We just reordered. Lets get Booking up to date and prices sorted out again.
                var items = tglBookingEditor.Options.ItineraryContainer.find(".type-program:not(.removing)");
                for (var i = 0; i < items.length; i++) {
                    tglBookingEditor.Booking.programs[i].id = $(items[i]).data("id");
                }

                updatePrices();

                // Wait briefly so the (potential) new validation messages don't pop up the moment we let gio but shortly after
                setTimeout(tglBookingEditor.ValidateItinerary, 100);
                return false;
            }, false);
            return new Slip(list);
        }

        this.ValidateItinerary = function()
        {
            // Check if booking is loaded and editable
            if(!tglBookingEditor.Booking.hasOwnProperty("programs") || !isItineraryEditable){
                return;
            }

            var programCount = [];

            /*var previousElement = null;
            var previousProgramId = "";
            var previousProgram = null;
            var previousProgramCount = 0;*/

            var currentProgramCount = 0;

            var weekDate = localDateStart;

            var items = tglBookingEditor.Options.ItineraryContainer.find(".type-program:not(.removing)");
            for (var i = 0; i < items.length; i++) {
                validateWeek(i, $(items[i]), items);
            }

            function validateWeek(index, $this, items) {
                // Get current element
                var currentProgram = tglContentBuffer.Buffer[$this.data("id")];

                // Get program of the previous week
                var previousProgram = null;
                if (index > 0) {
                    previousProgram = tglContentBuffer.Buffer[$(items[index - 1]).data("id")];                
                }

                // Copy the current date
                var currentWeekDate = weekDate;

                // Hide all messages. If they still aply we will get them back in a second
                $this.find(".message").hide();

                // Count how often we already had this program. Not necessarily consecutive.
                if (!programCount.hasOwnProperty(currentProgram.documentId)) {
                    programCount[currentProgram.documentId] = 0;
                }
                programCount[currentProgram.documentId]++;


                /*** CHECK 1: MINIMUM DURATION ***/

                // Memorize how often in a row we had this program.
                if (previousProgram == null || previousProgram.documentId != currentProgram.documentId) {
                    currentProgramCount = 1;
                } else {
                    currentProgramCount++;
                }

                if(index == items.length - 1 // This is the last item in the trip
                    || $(items[index + 1]).data("id") != currentProgram.documentId) { // Not the last but next week we do a different program

                    // Next week we have a different program than this week or the trip ends
                    // We need to check if the current program completed the minimum duration
                    var durationMin = currentProgram.availability.minDuration.value;
                    if (durationMin != null && currentProgramCount < durationMin) {
                        $this.find(".message.duration-min").show();
                    }
                }

                
                /*** CHECK 2: MAXIMUM DURATION ***/

                var durationMax = currentProgram.availability.maxDuration ? currentProgram.availability.maxDuration.value : null;
                if (durationMax != null && programCount[currentProgram.id] > durationMax) {
                    $this.find(".message.duration-max").show();
                }


                /*** CHECK 3: AVAILABLE/BOOKABLE FROM/TO ***/

                // Note: We don't check if a program is disabled, just if its not available/bookable anymore. This gives us more precise insight.
                var availableFrom = new Date(currentProgram.availability.availableFrom);
                var availableUntil = currentProgram.availability.availableUntil ? new Date(currentProgram.availability.availableUntil.value) : null;
                var bookableUntil = currentProgram.availability.bookableUntil ? new Date(currentProgram.availability.bookableUntil.value) : null;

                if (currentWeekDate < availableFrom) {
                    $this.find(".message.available-from .date").text(availableFrom.toLocaleDateString());
                    $this.find(".message.available-from").show();
                }

                // Was this program booked before?
                var countOriginal = tglBookingEditor.BookingUnmodified.programs.filter(function(p) { return p.id == currentProgram.id }).length;
                if(programCount[currentProgram.id] <= countOriginal) {

                    // Not booked before or for less weeks. So we need to check if the program is still available and bookable.
                    // That way we allow for previously booked programs to stay part of a booking
                    if (availableUntil != null && currentWeekDate > availableUntil) {
                        $this.find(".message.available-until .date").text(availableUntil.toLocaleDateString());
                        $this.find(".message.available-until").show();
                    }

                    if (bookableUntil != null && currentWeekDate > bookableUntil) {
                        // This should have been taken care of by the UI already
                    }
                }


                /*** CHECK 4: AGE ***/

                var ageMin = currentProgram.requirements.requirementMinimumAge ? currentProgram.requirements.requirementMinimumAge.value : null;
                var ageMax = currentProgram.requirements.requirementMaximumAge ? currentProgram.requirements.requirementMaximumAge.value : null;

                var birthday = new Date(tglBookingEditor.Booking.participant.birthday);
                var ageAtTime = calculateAge(birthday, currentWeekDate);
                if (ageMin != null && ageAtTime < ageMin) {
                    $this.find(".message.age-min").show();
                }
                if (ageMax != null && ageAtTime > ageMax) {
                    $this.find(".message.age-max").show();
                }


                /*** CHECK 5: PROGRAM STARTING DATE ***/

                if (previousProgram == null || previousProgram.documentId != currentProgram.documentId) {

                    // We're joining a new program. We need to check starting dates.
                    var relevantDates = currentProgram.startingDates.startingDates.find(function(x) { return x.year == currentWeekDate.getFullYear() });
                    if(relevantDates) {

                        // Starting dates have been announced already. Lets check if the date matches
                        if (!relevantDates.startsEveryWeek) {

                            // If the program starts every week, that's easy
                            // If it doesn't, we need to look at individual dates
                            var currentWeekTicks = currentWeekDate.getTime();
                            var startingDateTicks = currentProgram.startingDates.startingDates
                                .map(function(x) { x.dates })
                                .reduce(function(a, b){ return a.concat(b); })
                                .map(function(d) { return new Date(d).getTime() })
                                .sort(function(a, b) { return a - b });

                            if (!startingDateTicks.some(function(x){return x == currentWeekTicks})) {

                                // Program doesn't start on this date. Find alternative dates.
                                var datesBefore = startingDateTicks.filter(function(x){return x < currentWeekTicks});
                                var datesAfter = startingDateTicks.filter(function(x){return x > currentWeekTicks});

                                var dateString = "";
                                if(datesBefore.length == 0 && datesAfter.length == 0) {

                                    dateString = "another week";

                                } else if (datesBefore.length > 0 && datesAfter.length == 0){

                                    var dateBefore = new Date(datesBefore[datesBefore.length - 1]);
                                    dateString = "on " + dateBefore.toLocaleDateString();

                                } else if (datesBefore.length == 0 && datesAfter.length > 0){

                                    var dateAfter = new Date(datesAfter[0]);
                                    dateString = "on " + dateAfter.toLocaleDateString();
                                    
                                } else {

                                    var dateBefore = new Date(datesBefore[datesBefore.length - 1]);
                                    var dateAfter = new Date(datesAfter[0]);
                                    dateString = "on " + dateBefore.toLocaleDateString() + " or " + dateAfter.toLocaleDateString();
                                }

                                $this.find(".message.startdate .date").text(dateString);
                                $this.find(".message.startdate").show();
                            }
                        }

                    } else {

                        // Starting dates haven't been announced yet
                        $this.find(".message.startdate-not-announced .date").text(currentWeekDate.getFullYear());
                        $this.find(".message.startdate-not-announced").show();
                    }
                }


                /*** CHECK 6: HOLIDAYS ***/

                tglContentBuffer.LoadDocument(currentProgram.documentId, function(programDocFull) {
                    // tglContentBuffer.LoadDocument(programDocFull.locations[0].id, (locationDocFull) => {
                    //     tglContentBuffer.LoadDocument(locationDocFull.holidays.id, (holidayDocFull) => {
                            
                            // TODO: Show holidays that could affect the program

                            $this.find(".progress").hide();
                    //     }, tglBookingEditor.Options.CallbackCriticalError);
                    // }, tglBookingEditor.Options.CallbackCriticalError);
                }, tglBookingEditor.Options.CallbackCriticalError);   
                
                
                // TODO: Update price. Take the current one from the booking
                $this.find(".card-price span").text(tglBookingEditor.Booking.programs[i].price);

                // Update date on card
                $this.find(".date-start").text(currentWeekDate.toLocaleDateString());
                $this.find(".date-end").text(currentWeekDate.addDays(4).toLocaleDateString());
                $this.data("sequence-nr", index);

                // Prepare for next loop
                weekDate = weekDate.addDays(7);
            }      
        }

        function calculateAge(birthday, comparisonDate) {

            // Get the date difference and turn it into a date itself.
            // This way we approximately consider leap years, if the distance is big enough.
            var ageDate = new Date(comparisonDate - birthday);

            // Time srtarts counting from 1970. Deduct this from the date.
            return ageDate.getUTCFullYear() - 1970;
        }
        
        this.PopulateHistory = function() {

            if(tglBookingEditor.Options.BookingId == null){
                // We're creating a booking. No history yet.
                return;
            }
    
            if(tglBookingEditor.Options.HistoryContainer == null || tglBookingEditor.Options.TemplateHistory == null){
                // Seems like we're not actually displaying the history
                return;
            }

            // Show history now
            displayHistory()

            if(timerRefreshHistory == null){
                // No timer set yet. Do so now so the history refreshes every minute.
                timerRefreshHistory = setInterval(function() {

                    displayHistory();

                }, 60000);
            }

            function displayHistory(){
                
                tglApiClient.booking.listBookingHistory(tglBookingEditor.Options.BookingId, 99999999, function(historyRecords){
                    
                    tglBookingEditor.Options.HistoryContainer.empty();
                    for (var i = 0; i < historyRecords.length; i++) {
        
                        var html = createHistoryItem(historyRecords[i]);                    
                        tglBookingEditor.Options.HistoryContainer.append(html);
                    }
                });
            }
            
        }

        function createHistoryItem(record){
            
            var description = "";
            if(record.type == "Create"){

                description = 'created the booking';
            
            } else if(record.type == "Update" && record.valueBefore != null && record.valueAfter != null){

                description = 'updated <u>' + record.field + '</u> from <i>' + record.valueBefore + '</i> to <i>' + record.valueAfter + '</i>';

            } else if(record.type == "Update" && record.valueBefore != null && record.valueAfter == null){

                description = 'emptied <u>' + record.field + '</u>';
            
            } else if(record.type == "Update" && record.valueBefore == null && record.valueAfter != null){

                description = 'filled in <u>' + record.field + '</u> as <i>' + record.valueAfter + '</i>';
            
            } else if(record.type == "Delete"){

                description = 'cancelled the booking';

            } else if(record.type == "Add"){
                
                description = 'added <u>' + record.field + '</u>, <i>' + record.valueAfter + '</i>';

            } else if(record.type == "Remove"){
                
                description = 'removed <u>' + record.field + '</u>, <i>' + record.valueBefore + '</i>';
            }        

            var yesterday = new Date(new Date() - 1000*60*60*24);

            var timestamp = new Date(record.timestamp);
            var timeDifference = new Date(new Date() - timestamp);
            var timeDifferenceMinutes = Math.round((new Date() - timestamp) / 1000 / 60);
            var timestampString = "";
            if(timeDifferenceMinutes < 2){
                timestampString = "Just now"

            } else if(timeDifferenceMinutes < 50){
                timestampString = timeDifferenceMinutes.toString() + " minutes ago";

            } else if(timeDifferenceMinutes < 100){
                timestampString = "One hour ago";
                
            } else if(timeDifferenceMinutes < 360 || timestamp.getDate() == new Date().getDate()){
                var timeDifferenceHours = Math.floor((timeDifferenceMinutes + 20) / 60);
                timestampString = timeDifferenceHours + " hours ago";

            } else if (timestamp.getDate() == yesterday.getDate() && timestamp.getMonth() == yesterday.getMonth() && timestamp.getFullYear() == yesterday.getFullYear()) {
                timestampString = "Yesterday, " + timestamp.getHours().toString().padStart(2, "0") + ":" + timestamp.getMinutes().toString().padStart(2, "0");

            } else {
                timestampString = timestamp.getFullYear() + "-"
                    + (timestamp.getMonth() + 1).toString().padStart(2, "0") + "-"
                    + (timestamp.getDate() + 1).toString().padStart(2, "0") + " "
                    + timestamp.getHours().toString().padStart(2, "0") + ":"
                    + timestamp.getMinutes().toString().padStart(2, "0");
            }

            var context = {
                name: record.userName,
                description: description,
                timestamp: timestampString                    
            };
            return $(templateHistory(context));
        }
    }
}( jQuery ));