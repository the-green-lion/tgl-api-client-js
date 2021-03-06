/**
 * Loads program info and buffers it locally so single page apps can access it more efficiently
 *
 * @author  Bernhard Gessler
 * @version 1.0.2
 */
(function( $ ) {

    window.tglProgramBuffer = new function() {

        this.BufferSearch;
        var bufferFull = {};   
        this.BufferShort = {};
        
        this.Options = new function() {
            this.IncludeDisabled = false;
            this.ProgramTypes = ["Basic", "Exclusive", "Group", "Offer"];
        }
        
        function refreshBuffer(callbackSuccess, callbackFailed) {

            // Create a new lunr index. It will help us search our programs quickly
            tglProgramBuffer.BufferSearch = lunr(function () {
                this.field('countryCode', { boost: 20 })
                this.field('title', { boost: 10 })
                this.field('tags', { boost: 8 })
                this.field('location', { boost: 6 })
                this.field('country', { boost: 4 })
                this.field('intro', { boost: 2 })
                this.field('full', { boost: 2 })
            });
            
            // Empty program buffer
            tglProgramBuffer.BufferShort = {};

            // Reload all programs
            updateBuffer(new Date(2000, 0, 1), callbackSuccess, callbackFailed);
        }

        function updateBuffer(latestPublishedDate, callbackSuccess, callbackFailed) {

            // If we only allow enabled programs, we should only load these
            var indexBy = tglProgramBuffer.Options.IncludeDisabled ? "id" : "documentstate";
            var indexValue = tglProgramBuffer.Options.IncludeDisabled ? "all" : "Enabled"

            var loaded = {};
            tglApiClient.content.queryDocuments("program", indexBy, indexValue, function(documentIds) {
                tglProgramBuffer.LoadDocuments(documentIds, function(programs){
                    for (var progamId in programs) {
                        if (programs.hasOwnProperty(progamId)) {
    
                            // Only allowed program types
                            if(!tglProgramBuffer.Options.ProgramTypes.includes(programs[progamId].programType)) {
                                continue;
                            }
    
                            // If we don't include disabled programs but the program is disabled, skip it
                            if(!tglProgramBuffer.Options.IncludeDisabled && programs[progamId].documentState == "Disabled") {
                                continue;
                            }
    
                            // Update this progam in the local buffer
                            loaded[progamId] = false;
                            updateProgram(programs[progamId]);
                        }
                    }
    
                    if(Object.keys(loaded).length == 0){
    
                        // No programs or at least no relevant programs loaded
                        if (callbackSuccess) callbackSuccess();
                    }
                }, callbackFailed);
            }, callbackFailed, latestPublishedDate);

            function updateProgram(program){
                var countryId = program.country.id;
                var locationIds = program.locations.map(l => l.id);
                
                tglProgramBuffer.LoadDocument(countryId, function (documentCountry){
                    tglProgramBuffer.LoadDocuments(locationIds, function (documentsLocations){

                        //Put country into a dictionary object
                        var countries = {};
                        countries[program.country.id] = documentCountry;

                        prepareProgram(program, documentsLocations, countries);
                        loaded[program.documentId] = true;

                        // All documents loaded?
                        if(Object.values(loaded).every(t => t)){

                            localStorage.setItem('tgl_programs_buffer', JSON.stringify({
                                index: tglProgramBuffer.BufferSearch,
                                short: tglProgramBuffer.BufferShort,
                                includeDisabled: tglProgramBuffer.Options.IncludeDisabled,
                                programTypes: tglProgramBuffer.Options.ProgramTypes
                            }));

                            if (callbackSuccess) callbackSuccess();
                        }

                    }, callbackFailed);                            
                }, callbackFailed);                
            }
        }
        
        function prepareProgram(programFull, locations, countries) {
            
            console.log("Processing " + programFull.documentName);
            
            // Concat all locations of the program
            var locationNames = programFull.locations.map(l => l.name);
            var locationString = locationNames[0];
            if(locationNames.length > 1) {
                locationString = [locationNames.slice(0, -1).join(', '), locationNames[locationNames.length - 1]].join(" & ");
            }
            
            // Concat all parts of the slug
            var slug = countries[programFull.country.id].documentSlug + "-" +
                locations[programFull.locations[0].id].documentSlug + "-" +
                programFull.documentSlug + "-" +
                programFull.documentId;

            // Take most important things from program and save
            tglProgramBuffer.BufferShort[programFull.documentId] = {
                id: programFull.documentId,
                state: programFull.documentState,
                title: programFull.documentName,
                location: locationString,
                country: programFull.country.name,
                //intro: snapshot.val().desc_intro,
                imageSmall: programFull.media.images[0].sizes.find(elem => elem.size === "80, 80").url,
                imageMedium: programFull.media.images[0].sizes.find(elem => elem.size === "480, 360").url,
                slug: slug,
                ageMin: programFull.requirements.requirementMinimumAge ? programFull.requirements.requirementMinimumAge.value : null,
                ageMax: programFull.requirements.requirementMaximumAge ? programFull.requirements.requirementMaximumAge.value : null,
                durationMin: programFull.availability.minDuration.value,
                durationMax: programFull.availability.maxDuration ? programFull.availability.maxDuration.value : null,
                type: programFull.programType,
                price: programFull.price.prices,
                availableFrom : new Date(programFull.availability.availableFrom),
                availableUntil: programFull.availability.availableUntil ? new Date(programFull.availability.availableUntil.value) : null,
                bookableUntil: programFull.availability.bookableUntil ? new Date(programFull.availability.bookableUntil.value) : null,
                startingDates: programFull.startingDates.startingDates,
                lastPublished: programFull.documentLastPublished
            };

            // Parse HTML to get plain text
            var overviewText = $($.parseHTML( programFull.overview.raw.contentHtml )).text();
            //var descriptionText = $($.parseHTML( programFull.description.raw.contentHtml )).text();

            // Add to lunr index
            tglProgramBuffer.BufferSearch.update({
                "countryCode": countries[programFull.country.id].isoCode,
                "title": programFull.documentName,
                "tags": programFull.tags ? programFull.tags.join(" ") : "",
                "location": locationString,
                "country": programFull.country.name,
                "intro":overviewText,
                //"full": descriptionText,
                "id": programFull.documentId
            });
        }

        this.LoadDocument = function (documentId, callbackSuccess, callbackFailed) {
                    
            if (bufferFull.hasOwnProperty(documentId) && !bufferFull[documentId].hasOwnProperty("callbacks")) {
                
                // Option 1: We already loaded and buffered the doc. Just take it from there.
                callbackSuccess(bufferFull[documentId]);

            } else if (bufferFull.hasOwnProperty(documentId)) {

                // Option 2: We don't have the doc buffered yet but are waiting for it already.
                // We add the current callback to the callback list
                bufferFull[documentId].callbacks.push(callbackSuccess);

            } else {
                
                // Option 3: This is the first time we ask for this doc
                // Lets create the callback queue and start loading the doc
                bufferFull[documentId] = {
                    callbacks: [ callbackSuccess ]
                };

                tglApiClient.content.getDocument(documentId, function(doc) {
                    
                    // Remember our callbacks
                    var pendingCallbacks = bufferFull[documentId].callbacks;

                    // Add the doc to our doc buffer
                    bufferFull[documentId] = doc;

                    pendingCallbacks.forEach(c => c(doc));

                }, function(error) {
                    if (callbackFailed) callbackFailed(error);
                }); 
            }                
        }

        this.LoadDocuments = function(documentIds, callbackSuccess, callbackFailed) {
            
            // Did we get any IDs? Otherwise nothing to return.
            if(documentIds.length == 0){
                if (callbackSuccess) callbackSuccess({});
                return;
            }

            // Go through all loaded document IDs and add them to our list
            var allDocuments = {};
            for (var i = 0; i < documentIds.length; i++) {

                tglProgramBuffer.LoadDocument(documentIds[i], function(doc) {
                        
                    // Add the doc to our doc list
                    allDocuments[doc.documentId] = doc;

                    // Check if we're done loading everything we wanted to load
                    if(documentIds.every(id => allDocuments.hasOwnProperty(id))){
                        if (callbackSuccess) callbackSuccess(allDocuments);
                    }

                }, function(error) {
                    if (callbackFailed) callbackFailed(error);
                }); 
            }            
        }

        this.LoadBuffer = function(callbackSuccess, callbackFailed) {
            //refreshBuffer(callbackSuccess, callbackFailed);

            if (localStorage.tgl_programs_buffer) {

                var localStorageObject = JSON.parse(localStorage.tgl_programs_buffer);

                // Check if the buffer was loaded with the same settings as we have now.
                // If not, we need to reload it with the current settings
                if(localStorageObject.includeDisabled != tglProgramBuffer.Options.IncludeDisabled || 
                    localStorageObject.programTypes.length != tglProgramBuffer.Options.ProgramTypes.length ||
                    localStorageObject.programTypes.some((value, index) => value !== tglProgramBuffer.Options.ProgramTypes[index])) {

                    refreshBuffer(callbackSuccess, callbackFailed);
                    return;
                }

                // Restore Index and buffer and update both with latest changes
                tglProgramBuffer.BufferSearch = lunr.Index.load( localStorageObject.index );
                tglProgramBuffer.BufferShort = localStorageObject.short;

                // Temporary transition logic
                if(!tglProgramBuffer.BufferShort[Object.keys(tglProgramBuffer.BufferShort)[0]].hasOwnProperty("lastPublished") ||
                    !tglProgramBuffer.BufferShort[Object.keys(tglProgramBuffer.BufferShort)[0]].hasOwnProperty("startingDates")){
                    refreshBuffer(callbackSuccess, callbackFailed);
                    return;
                }

                // Find the latest point in time any of the currently buffered documents was published
                var latestPublishedDate = new Date(Math.max.apply(null, Object.values(tglProgramBuffer.BufferShort).map(p => new Date(p.lastPublished))));
                updateBuffer(latestPublishedDate, callbackSuccess, callbackFailed);

            } else {
                // Index does not exist. Build new one.
                refreshBuffer(callbackSuccess, callbackFailed);
            }
        }
    }
}( jQuery ));