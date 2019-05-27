/**
 * Provides fast client side search using the tglContentBuffer
 *
 * @author  Bernhard Gessler
 * @version 1.1.4
 */
(function( $ ) {
    var isoCountries = {
        'AF' : 'Afghanistan',
        'AX' : 'Aland Islands',
        'AL' : 'Albania',
        'DZ' : 'Algeria',
        'AS' : 'American Samoa',
        'AD' : 'Andorra',
        'AO' : 'Angola',
        'AI' : 'Anguilla',
        'AQ' : 'Antarctica',
        'AG' : 'Antigua And Barbuda',
        'AR' : 'Argentina',
        'AM' : 'Armenia',
        'AW' : 'Aruba',
        'AU' : 'Australia',
        'AT' : 'Austria',
        'AZ' : 'Azerbaijan',
        'BS' : 'Bahamas',
        'BH' : 'Bahrain',
        'BD' : 'Bangladesh',
        'BB' : 'Barbados',
        'BY' : 'Belarus',
        'BE' : 'Belgium',
        'BZ' : 'Belize',
        'BJ' : 'Benin',
        'BM' : 'Bermuda',
        'BT' : 'Bhutan',
        'BO' : 'Bolivia',
        'BA' : 'Bosnia And Herzegovina',
        'BW' : 'Botswana',
        'BV' : 'Bouvet Island',
        'BR' : 'Brazil',
        'IO' : 'British Indian Ocean Territory',
        'BN' : 'Brunei Darussalam',
        'BG' : 'Bulgaria',
        'BF' : 'Burkina Faso',
        'BI' : 'Burundi',
        'KH' : 'Cambodia',
        'CM' : 'Cameroon',
        'CA' : 'Canada',
        'CV' : 'Cape Verde',
        'KY' : 'Cayman Islands',
        'CF' : 'Central African Republic',
        'TD' : 'Chad',
        'CL' : 'Chile',
        'CN' : 'China',
        'CX' : 'Christmas Island',
        'CC' : 'Cocos (Keeling) Islands',
        'CO' : 'Colombia',
        'KM' : 'Comoros',
        'CG' : 'Congo',
        'CD' : 'Congo, Democratic Republic',
        'CK' : 'Cook Islands',
        'CR' : 'Costa Rica',
        'CI' : 'Cote D\'Ivoire',
        'HR' : 'Croatia',
        'CU' : 'Cuba',
        'CY' : 'Cyprus',
        'CZ' : 'Czech Republic',
        'DK' : 'Denmark',
        'DJ' : 'Djibouti',
        'DM' : 'Dominica',
        'DO' : 'Dominican Republic',
        'EC' : 'Ecuador',
        'EG' : 'Egypt',
        'SV' : 'El Salvador',
        'GQ' : 'Equatorial Guinea',
        'ER' : 'Eritrea',
        'EE' : 'Estonia',
        'ET' : 'Ethiopia',
        'FK' : 'Falkland Islands (Malvinas)',
        'FO' : 'Faroe Islands',
        'FJ' : 'Fiji',
        'FI' : 'Finland',
        'FR' : 'France',
        'GF' : 'French Guiana',
        'PF' : 'French Polynesia',
        'TF' : 'French Southern Territories',
        'GA' : 'Gabon',
        'GM' : 'Gambia',
        'GE' : 'Georgia',
        'DE' : 'Germany',
        'GH' : 'Ghana',
        'GI' : 'Gibraltar',
        'GR' : 'Greece',
        'GL' : 'Greenland',
        'GD' : 'Grenada',
        'GP' : 'Guadeloupe',
        'GU' : 'Guam',
        'GT' : 'Guatemala',
        'GG' : 'Guernsey',
        'GN' : 'Guinea',
        'GW' : 'Guinea-Bissau',
        'GY' : 'Guyana',
        'HT' : 'Haiti',
        'HM' : 'Heard Island & Mcdonald Islands',
        'VA' : 'Holy See (Vatican City State)',
        'HN' : 'Honduras',
        'HK' : 'Hong Kong',
        'HU' : 'Hungary',
        'IS' : 'Iceland',
        'IN' : 'India',
        'ID' : 'Indonesia',
        'IR' : 'Iran, Islamic Republic Of',
        'IQ' : 'Iraq',
        'IE' : 'Ireland',
        'IM' : 'Isle Of Man',
        'IL' : 'Israel',
        'IT' : 'Italy',
        'JM' : 'Jamaica',
        'JP' : 'Japan',
        'JE' : 'Jersey',
        'JO' : 'Jordan',
        'KZ' : 'Kazakhstan',
        'KE' : 'Kenya',
        'KI' : 'Kiribati',
        'KR' : 'Korea',
        'KW' : 'Kuwait',
        'KG' : 'Kyrgyzstan',
        'LA' : 'Lao People\'s Democratic Republic',
        'LV' : 'Latvia',
        'LB' : 'Lebanon',
        'LS' : 'Lesotho',
        'LR' : 'Liberia',
        'LY' : 'Libyan Arab Jamahiriya',
        'LI' : 'Liechtenstein',
        'LT' : 'Lithuania',
        'LU' : 'Luxembourg',
        'MO' : 'Macao',
        'MK' : 'Macedonia',
        'MG' : 'Madagascar',
        'MW' : 'Malawi',
        'MY' : 'Malaysia',
        'MV' : 'Maldives',
        'ML' : 'Mali',
        'MT' : 'Malta',
        'MH' : 'Marshall Islands',
        'MQ' : 'Martinique',
        'MR' : 'Mauritania',
        'MU' : 'Mauritius',
        'YT' : 'Mayotte',
        'MX' : 'Mexico',
        'FM' : 'Micronesia, Federated States Of',
        'MD' : 'Moldova',
        'MC' : 'Monaco',
        'MN' : 'Mongolia',
        'ME' : 'Montenegro',
        'MS' : 'Montserrat',
        'MA' : 'Morocco',
        'MZ' : 'Mozambique',
        'MM' : 'Myanmar',
        'NA' : 'Namibia',
        'NR' : 'Nauru',
        'NP' : 'Nepal',
        'NL' : 'Netherlands',
        'AN' : 'Netherlands Antilles',
        'NC' : 'New Caledonia',
        'NZ' : 'New Zealand',
        'NI' : 'Nicaragua',
        'NE' : 'Niger',
        'NG' : 'Nigeria',
        'NU' : 'Niue',
        'NF' : 'Norfolk Island',
        'MP' : 'Northern Mariana Islands',
        'NO' : 'Norway',
        'OM' : 'Oman',
        'PK' : 'Pakistan',
        'PW' : 'Palau',
        'PS' : 'Palestinian Territory, Occupied',
        'PA' : 'Panama',
        'PG' : 'Papua New Guinea',
        'PY' : 'Paraguay',
        'PE' : 'Peru',
        'PH' : 'Philippines',
        'PN' : 'Pitcairn',
        'PL' : 'Poland',
        'PT' : 'Portugal',
        'PR' : 'Puerto Rico',
        'QA' : 'Qatar',
        'RE' : 'Reunion',
        'RO' : 'Romania',
        'RU' : 'Russian Federation',
        'RW' : 'Rwanda',
        'BL' : 'Saint Barthelemy',
        'SH' : 'Saint Helena',
        'KN' : 'Saint Kitts And Nevis',
        'LC' : 'Saint Lucia',
        'MF' : 'Saint Martin',
        'PM' : 'Saint Pierre And Miquelon',
        'VC' : 'Saint Vincent And Grenadines',
        'WS' : 'Samoa',
        'SM' : 'San Marino',
        'ST' : 'Sao Tome And Principe',
        'SA' : 'Saudi Arabia',
        'SN' : 'Senegal',
        'RS' : 'Serbia',
        'SC' : 'Seychelles',
        'SL' : 'Sierra Leone',
        'SG' : 'Singapore',
        'SK' : 'Slovakia',
        'SI' : 'Slovenia',
        'SB' : 'Solomon Islands',
        'SO' : 'Somalia',
        'ZA' : 'South Africa',
        'GS' : 'South Georgia And Sandwich Isl.',
        'ES' : 'Spain',
        'LK' : 'Sri Lanka',
        'SD' : 'Sudan',
        'SR' : 'Suriname',
        'SJ' : 'Svalbard And Jan Mayen',
        'SZ' : 'Swaziland',
        'SE' : 'Sweden',
        'CH' : 'Switzerland',
        'SY' : 'Syrian Arab Republic',
        'TW' : 'Taiwan',
        'TJ' : 'Tajikistan',
        'TZ' : 'Tanzania',
        'TH' : 'Thailand',
        'TL' : 'Timor-Leste',
        'TG' : 'Togo',
        'TK' : 'Tokelau',
        'TO' : 'Tonga',
        'TT' : 'Trinidad And Tobago',
        'TN' : 'Tunisia',
        'TR' : 'Turkey',
        'TM' : 'Turkmenistan',
        'TC' : 'Turks And Caicos Islands',
        'TV' : 'Tuvalu',
        'UG' : 'Uganda',
        'UA' : 'Ukraine',
        'AE' : 'United Arab Emirates',
        'GB' : 'United Kingdom',
        'US' : 'United States',
        'UM' : 'United States Outlying Islands',
        'UY' : 'Uruguay',
        'UZ' : 'Uzbekistan',
        'VU' : 'Vanuatu',
        'VE' : 'Venezuela',
        'VN' : 'Viet Nam',
        'VG' : 'Virgin Islands, British',
        'VI' : 'Virgin Islands, U.S.',
        'WF' : 'Wallis And Futuna',
        'EH' : 'Western Sahara',
        'YE' : 'Yemen',
        'ZM' : 'Zambia',
        'ZW' : 'Zimbabwe'
    };

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
            templateProgram = Handlebars.compile(sourceProgram);;

            $searchField.typeWatch( {
                callback: instance.Search,
                wait: 400,
                allowSubmit: false,
                captureLength: 2
            } );
        }

        this.Search = function() {
            var resultItems = null;
            if ($searchField.val().length >= instance.Options.MinimumCharactersForSearch) {
                var searchTerms = $searchField.val().split(" ");

                searchTerms.forEach(function (value, index, array) {

                    // Make sure we're not carrying unnecessary white spaces
                    value = value.trim();

                    // If this is a special query, don't take further action
                    if(value.trim() == "" || value.startsWith("-") || value.startsWith("+") || value.endsWith("*")) return;

                    // If its a ISO country code, make it obligatory
                    else if(isoCountries.hasOwnProperty(value.toUpperCase())) searchTerms[index] = "+" + value;

                    // Else, search for the term but also prefixes
                    else searchTerms[index] = value + " " + value + "*";
                });

                results = tglContentBuffer.Index.search(searchTerms.join(" "));                                        
                resultItems = results.map(x => tglContentBuffer.Buffer[x.ref]);
            }
                                
            renderSearchResults(filterAndSort(resultItems));
        }
    
        this.Clear = function() {
            $searchField.val("");    
            renderSearchResults(filterAndSort(null));
        }

        function filterAndSort(resultItems) {
    
            if(resultItems != null && !instance.Options.IncludeDisabled){
                resultItems = resultItems.filter(x => x.documentState == "Enabled");
            }
    
            if(resultItems != null && !instance.Options.IncludeNonBookable){
    
                var today = new Date();
                today.setHours(0,0,0,0);            
                resultItems = resultItems.filter(x => x.availability.bookableUntil == null || x.availability.bookableUntil >= today);
            }
    
            // If we're not typing anything into search yet, show all programs
            if(resultItems == null && instance.Options.ShowAllIfEmpty){
                resultItems = Object.values(tglContentBuffer.Buffer).filter(x => x.documentType == "Program").sort((a,b) => a.documentName.localeCompare(b.title));
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
                        id: resultItems[i].documentId,
                        location: tglContentBuffer.GetProgramLocationString(resultItems[i]),
                        imageUrl: resultItems[i].media.images[0].sizes.find(elem => elem.size === "480, 360").url,
                        title: resultItems[i].documentName,
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