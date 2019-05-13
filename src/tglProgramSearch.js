/**
 * Provides fast client side search using the tglProgramBuffer
 *
 * @author  Bernhard Gessler
 * @version 1.0.0
 */
(function( $ ) {
    $.fn.tglProgramSearch = function (options) {

        return this.each(function () {

            var $this = $(this);

            // check if there is an existing instance related to element
            var instance = $this.data("tglProgramSearch");

            if (instance) {
                return instance;
            } else {
                // create the plugin
                var plugin = new tglProgramSearchPlugin();

                // Set Options
                plugin.Options = $.extend( {}, plugin.Options, options );
                plugin.Options.SearchContainer = $this;
                plugin.Init();


                // Store the plugin instance on the element
                $this.data("tglProgramSearch", plugin);
                return plugin;
            }
        });
    }

    function tglProgramSearchPlugin() {

        // --------------
        // PRIVATE VARIABLES
        // --------------
    
        var instance = this;
        var $searchField;
        var $resultList;
        var $instruction;
    
        // --------------
        // PRECOMPILED HANDLEBARS TEMPLATES
        // --------------
        var templateProgram;
        
        // --------------
        // OPTIONS
        // --------------
        this.Options = new function() {
            this.MinimumCharactersForSearch = 3;
    
            this.IncludeDisabled = false;
            this.IncludeNonBookable = false;
            this.ShowAllIfEmpty = false;
            
            this.SearchResultFilter = null;
    
            this.SearchContainer;
            this.TemplateProgram;

            this.CallbackDisplayResultsAfter;
        }
    
        this.Init = function(options){

            $searchField = instance.Options.SearchContainer.find('.search-term');
            $resultList = instance.Options.SearchContainer.find('.search-results');
            $instruction = instance.Options.SearchContainer.find('.instruction');

            var sourceProgram = instance.Options.TemplateProgram.html();
            templateProgram = Handlebars.compile(sourceProgram);           
    
            // Listen to any change in the search field
            // Possibly replace with https://github.com/dennyferra/TypeWatch
            $searchField.typing({
                stop: instance.Search,
                delay: 400
            });
        }

        this.Search = function() {
            var resultItems = null;
            if ($searchField.val().length >= instance.Options.MinimumCharactersForSearch) {
                results = tglProgramBuffer.BufferSearch.search($searchField.val());                                        
                resultItems = results.map(x => tglProgramBuffer.BufferShort[x.ref]);
            }
                                
            renderSearchResults(filterAndSort(resultItems));
        }
    
        this.Clear = function() {
            $searchField.val("");    
            renderSearchResults(filterAndSort(null));
        }

        function filterAndSort(resultItems) {
    
            if(resultItems != null && !instance.Options.IncludeDisabled){
                resultItems = resultItems.filter(x => x.state == "Enabled");
            }
    
            if(resultItems != null && !instance.Options.IncludeNonBookable){
    
                var today = new Date();
                today.setHours(0,0,0,0);            
                resultItems = resultItems.filter(x => x.bookableUntil == null || x.bookableUntil >= today);
            }
    
            // If we're not typing anything into search yet, show all programs
            if(resultItems == null && instance.Options.ShowAllIfEmpty){
                resultItems = Object.values(tglProgramBuffer.BufferShort).sort((a,b) => a.title.localeCompare(b.title));
            }

            // Apply any additional filtering
            if(instance.Options.SearchResultFilter != null) {
                resultItems = instance.Options.SearchResultFilter(resultItems);
            }
    
            return resultItems;
        }
    
        function renderSearchResults(resultItems) {
            $instruction.hide();
    
            if(resultItems == null || resultItems.length == 0) {
    
                // No valid search input or no results
                $resultList.empty();
                $instruction.show();
                       
            } else {
                
                // We found programs
                $resultList.empty();
                for (i = 0; i < resultItems.length; i++) {
        
                    var context = {
                        id: resultItems[i].id,
                        location: resultItems[i].location,
                        imageUrl: resultItems[i].imageMedium,
                        title: resultItems[i].title,
                        //price: 7,          
                    };
    
                    var $html = $(templateProgram(context));
    
                    if (resultItems[i].state == "Disabled") {
                        $html.find(".message.is-disabled").show();
                    }
    
                    $resultList.append($html);
                }
    
                if(instance.Options.CallbackDisplayResultsAfter) instance.Options.CallbackDisplayResultsAfter();
            }
        }    
    }
}( jQuery ));