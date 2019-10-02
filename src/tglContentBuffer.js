/**
 * Loads documents and buffers them locally so single page apps can access them more efficiently
 *
 * @author  Bernhard Gessler
 * @version 1.0.1
 */
(function( $ ) {

    window.tglContentBuffer = new function() {

        this.Index = null;
        var bufferInternal = {};
        this.Buffer = {};
        
        this.Options = new function() {
            this.IncludeDisabled = false;
            this.EnableSearch = false;
            this.EnableAutoUpdate = true;
            this.OfflineMode = false;
            this.DocumentTypes = ["program", "location", "country", "holidays", "arrivalinfo", "departureinfo"];
            this.ProgramTypes = ["Basic", "Exclusive", "Group", "Offer"];

            this.CallbackBufferReady;
            this.CallbackSearchReady;
            this.CallbackLoadingFailed;
            this.CallbackUpdated;
            this.CallbackUpdateFailed;
        }

        function getLatestPublishedDate(){
            return new Date(Math.max.apply(null, Object.values(tglContentBuffer.Buffer).map(function(p) { return new Date(p.documentLastPublished) })));
        }

        function refreshBuffer(callbackSuccess, callbackFailed) {
                      
            // Empty program buffer
            tglContentBuffer.Index = null;
            tglContentBuffer.Buffer = {};

            // Reload all programs
            updateBuffer(new Date(2000, 0, 1), callbackSuccess, callbackFailed);
        }

        this.UpdateBuffer = function(callbackSuccess, callbackFailed) {
            updateBuffer(getLatestPublishedDate(), callbackSuccess, callbackFailed);
        }
               
        function updateBuffer(latestPublishedDate, callbackSuccess, callbackFailed) {

            if(latestPublishedDate == null){
                latestPublishedDate = getLatestPublishedDate();
            }

            // If we only allow enabled programs, we should only load these
            var indexBy = tglContentBuffer.Options.IncludeDisabled ? "id" : "documentstate";
            var indexValue = tglContentBuffer.Options.IncludeDisabled ? "all" : "Enabled"

            var loaded = {};
            tglContentBuffer.Options.DocumentTypes.forEach(function(documentType) {
                loaded[documentType] = -1;

                tglApiClient.content.queryDocuments(documentType, indexBy, indexValue, function(documentIds) {

                    if(documentIds.length == 0){
                        // No document changed since the last time. Nothing to do.
                        loaded[documentType] = 0;
                        documentTypeLoaded();
                        return;
                    }

                    tglContentBuffer.LoadDocuments(documentIds, function(documents){
                        for (var documentId in documents) {
                            if (documents.hasOwnProperty(documentId)) {
                                
                                // Check if the doc should be buffered
                                if(!filterDocuments(documents[documentId])){
                                    continue;
                                }

                                tglContentBuffer.Buffer[documentId] = documents[documentId];
                            }
                        }
        
                        // Set this document type as fully loaded
                        loaded[documentType] = documentIds.length;
                        documentTypeLoaded();
                    }, callbackFailed);
                }, callbackFailed, latestPublishedDate);
            });

            function filterDocuments(document){
                if(document.documentType == "Program"){

                    // Only allowed program types
                    if(!tglContentBuffer.Options.ProgramTypes.includes(document.programType)) {
                        return false;
                    }               
                }

                return true;
            }
            
            function documentTypeLoaded(){

                // All document types loaded?
                var loadedCounts = Object.values(loaded);
                if(loadedCounts.every(function(t) { return t >= 0 })){
                    var isUpdated = loadedCounts.some(function(t) { return t > 0 });

                    // If Search is enabled, we need to build or update the search index
                    // If either we had no search index yet or the index outdated (more than zero docs were loaded), we build a new one
                    if(tglContentBuffer.Options.EnableSearch && (tglContentBuffer.Index == null || isUpdated)){
                        isUpdated = true;                      
                        
                        tglContentBuffer.Index = lunr(function () {
                            this.ref('id')
                            this.field('countryCode', { boost: 20 })
                            this.field('title', { boost: 10 })
                            this.field('tags', { boost: 8 })
                            this.field('location', { boost: 6 })
                            this.field('country', { boost: 4 })
                            this.field('intro', { boost: 2 })
                            this.field('full', { boost: 2 })
                          
                            for (var documentId in tglContentBuffer.Buffer) {
                                if (tglContentBuffer.Buffer.hasOwnProperty(documentId)){
                                    var currentDocument = tglContentBuffer.Buffer[documentId];
                                    if(currentDocument.documentType == "Program") {
                                    
                                        // Parse HTML to get plain text
                                        var overviewText = $($.parseHTML( currentDocument.overview.raw.contentHtml )).text();

                                        // Add to Index
                                        this.add({
                                            id: currentDocument.documentId,
                                            countryCode: tglContentBuffer.Buffer[currentDocument.country.id].isoCode,
                                            title: currentDocument.documentName,
                                            tags: currentDocument.tags ? currentDocument.tags.join(" ") : "",
                                            location: tglContentBuffer.GetProgramLocationString(currentDocument),
                                            country: currentDocument.country.name,
                                            intro: overviewText
                                        });
                                    }
                                }
                            }
                        });                    
                    }

                    // If changed, save locally
                    if(isUpdated){

                        // Compress and store
                        // localStorage.setItem('tgl_content_index', LZString.compress(JSON.stringify(tglContentBuffer.Index)));
                        // localStorage.setItem('tgl_content_buffer', LZString.compress(JSON.stringify(tglContentBuffer.Buffer)));

                        localStorage.setItem('tgl_content_buffer', zipson.stringify(tglContentBuffer.Buffer));
                        if(tglContentBuffer.Options.EnableSearch) localStorage.setItem('tgl_content_index', LZString.compress(JSON.stringify(tglContentBuffer.Index)));                        

                        localStorage.setItem('tgl_content_options', JSON.stringify({
                            includeDisabled: tglContentBuffer.Options.IncludeDisabled,
                            programTypes: tglContentBuffer.Options.ProgramTypes
                        }));

                        if (callbackSuccess) callbackSuccess();
                    }
                }
            }
        }

        this.GetProgramSlug = function (program) {
            var firstLocation = tglContentBuffer.Buffer[program.locations[0].id];
            var country = countries[program.country.id];

            return country.documentSlug + "-" + firstLocation.documentSlug + "-" + program.documentSlug + "-" + program.documentId;
        }

        this.GetProgramLocationString = function (program) {
            var locationNames = program.locations.map(function(l) { return l.name });
            var locationString = locationNames[0];
            if(locationNames.length > 1) {
                locationString = [locationNames.slice(0, -1).join(', '), locationNames[locationNames.length - 1]].join(" & ");
            }

            return locationString;
        }

        this.LoadDocument = function (documentId, callbackSuccess, callbackFailed) {
                    
            if (tglContentBuffer.Buffer.hasOwnProperty(documentId)) {
                
                // Option 1: We have the doc in our official buffer. Just take it from there.
                callbackSuccess(tglContentBuffer.Buffer[documentId]);

            } else if (bufferInternal.hasOwnProperty(documentId) && !bufferInternal[documentId].hasOwnProperty("callbacks")) {
                
                // Option 2: We already loaded and buffered the doc. Just take it from there.
                callbackSuccess(bufferInternal[documentId]);

            } else if (bufferInternal.hasOwnProperty(documentId)) {

                // Option 3: We don't have the doc buffered yet but are waiting for it already.
                // We add the current callback to the callback list
                bufferInternal[documentId].callbacks.push(callbackSuccess);

            } else {
                
                // Option 4: This is the first time we ask for this doc
                // Lets create the callback queue and start loading the doc
                bufferInternal[documentId] = {
                    callbacks: [ callbackSuccess ]
                };

                tglApiClient.content.getDocument(documentId, function(doc) {
                    
                    // Remember our callbacks
                    var pendingCallbacks = bufferInternal[documentId].callbacks;

                    // Add the doc to our doc buffer
                    bufferInternal[documentId] = doc;

                    pendingCallbacks.forEach(function(c) { return c(doc) });

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

                tglContentBuffer.LoadDocument(documentIds[i], function(doc) {
                        
                    // Add the doc to our doc list
                    allDocuments[doc.documentId] = doc;

                    // Check if we're done loading everything we wanted to load
                    if(documentIds.every(function(id) { return allDocuments.hasOwnProperty(id) })){
                        if (callbackSuccess) callbackSuccess(allDocuments);
                    }

                }, function(error) {
                    if (callbackFailed) callbackFailed(error);
                }); 
            }            
        }

        this.LoadBuffer = function() {
            //refreshBuffer(callbackSuccess, callbackFailed);

            localStorage.removeItem("tgl_programs_buffer");

            if (localStorage.tgl_content_options && localStorage.tgl_content_buffer && localStorage.tgl_content_index) {

                // Check if the buffer was loaded with the same settings as we have now.
                // If not, we need to reload it with the current settings
                var localStorageOptions = JSON.parse(localStorage.tgl_content_options);
                if(localStorageOptions.includeDisabled != tglContentBuffer.Options.IncludeDisabled || 
                    localStorageOptions.programTypes.length != tglContentBuffer.Options.ProgramTypes.length ||
                    localStorageOptions.programTypes.some(function(value, index) { return value !== tglContentBuffer.Options.ProgramTypes[index] })) {

                    refreshBuffer(function(){
                        if (tglContentBuffer.Options.CallbackBufferReady) tglContentBuffer.Options.CallbackBufferReady();
                        if (tglContentBuffer.Options.EnableSearch && tglContentBuffer.Options.CallbackSearchReady) tglContentBuffer.Options.CallbackSearchReady();
                    }, tglContentBuffer.Options.CallbackLoadingFailed);
                    return;
                }

                // tglContentBuffer.Buffer = JSON.parse(LZString.decompress(localStorage.tgl_content_buffer));
                tglContentBuffer.Buffer = zipson.parse(localStorage.tgl_content_buffer);
                if (tglContentBuffer.Options.CallbackBufferReady) tglContentBuffer.Options.CallbackBufferReady();
                
                if(tglContentBuffer.Options.EnableSearch) {
                    tglContentBuffer.Index = lunr.Index.load(JSON.parse(LZString.decompress(localStorage.tgl_content_index)));
                    //tglContentBuffer.Index = lunr.Index.load(zipson.parse(localStorage.tgl_content_index));
                    if (tglContentBuffer.Options.CallbackSearchReady) tglContentBuffer.Options.CallbackSearchReady();
                }                

                // Wait a little bit to let other loading functionality run first, then update the buffer
                setTimeout(function(){ 
                    if(!tglContentBuffer.Options.OfflineMode){
                        tglContentBuffer.UpdateBuffer(tglContentBuffer.Options.CallbackUpdated, tglContentBuffer.Options.CallbackUpdateFailed);
                    }
                 }, 1000);
                
                // Update buffer every 10 minutes
                setInterval(function(){ 
                    if(tglContentBuffer.Options.EnableAutoUpdate && !tglContentBuffer.Options.OfflineMode){
                        tglContentBuffer.UpdateBuffer(tglContentBuffer.Options.CallbackUpdated, tglContentBuffer.Options.CallbackUpdateFailed);
                    }
                }, 1000 * 60 * 10);

            } else {
                
                // Index does not exist. Build new one.
                refreshBuffer(function(){
                    if (tglContentBuffer.Options.CallbackBufferReady) tglContentBuffer.Options.CallbackBufferReady();
                    if (tglContentBuffer.Options.EnableSearch && tglContentBuffer.Options.CallbackSearchReady) tglContentBuffer.Options.CallbackSearchReady();
                }, tglContentBuffer.Options.CallbackLoadingFailed);
            }
        }
    }
}( jQuery ));