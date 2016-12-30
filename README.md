TGL API Client
============

Javascript client for TGL's REST API.

You may also be interested in our [PHP](https://github.com/the-green-lion/tgl-api-client-php) and [.Net](https://github.com/the-green-lion/tgl-api-client-csharp) client libraries or our [Wordpress Plugin](https://github.com/the-green-lion/wp-tgl-content-insert).

##Dependencies
This library depends on [firebase 3](https://firebase.google.com/docs/web/setup). Add at least the folllowing files:
- https://www.gstatic.com/firebasejs/3.6.1/firebase-app.js
- https://www.gstatic.com/firebasejs/3.6.1/firebase-auth.js
- https://www.gstatic.com/firebasejs/3.6.1/firebase-database.js

Also, jQuery is required. This library was built against verion 3.1.0

## Basic Usage

```js

// Sign in. If you're already signed in, this has no effect and the success callback is called right away.
// Currently there is no way to sign out.
tglApiClient.auth.signInWithApiKey("YOUR API KEY", function(){
    
    // Great, we're logged in. Do something.
    doStuff();
    
}, function(error) {
    console.log("Failed to log in");
});

function doStuff(){
    
    // There is only one singleton instance. No need to carry around the instance
    // Now, lets load a document by its ID
    tglApiClient.content.getDocument("ID OF A DOCUMENT", function(doc) {
        
        // Loaded
        
    }, function(error) {
        console.log("Failed loading document. Error: " + error);
    });
};

```

## How to use the data
Please have a look at the explanation on the site of our [Wordpress plugin](https://github.com/the-green-lion/wp-tgl-content-insert)
