$(document).ready( function() {
    $("#btnRouteRadio").on('click', dorouteradio);
    setupPlumbing();
    setupWebsocket();
});

var name = gup('name') || window.location.href; 
var server = gup('server') || 'localhost';

var dorouteradio = function(e){
    if (e){e.preventDefault();};
    var selectedPub = $("input[name=pub]:radio:checked").val();
    var selectedSub = $("input[name=sub]:radio:checked").val();
    if (selectedPub && selectedSub){
        selectedPub = selectedPub.split('_').map(Unsafetify);
        selectedSub = selectedSub.split('_').map(Unsafetify);
        if (selectedPub.length == 4 && selectedSub.length == 4){
            ws.send(JSON.stringify({
                route:{type:'add',
                        publisher:{clientName:selectedPub[0],
                                    name:selectedPub[2],
                                    type:selectedPub[3],
                                    remoteAddress:selectedPub[1]},
                        subscriber:{clientName:selectedSub[0],
                                    name:selectedSub[2],
                                    type:selectedSub[3],
                                    remoteAddress:selectedSub[1]}}
            }));
        }
    }
};

var dorouteremove = function(index){
    if (index >= 0 && index < routes.length){
        var toRemove = routes.splice(index, 1);
        if (toRemove.length > 0){
            toRemove = toRemove[0];
            ws.send(JSON.stringify({
                route:{type:'remove',
                        publisher:toRemove.publisher,
                        subscriber:toRemove.subscriber}
            }));
        }
    }
};

var ws;
var setupWebsocket = function(){
    ws = new WebSocket("ws://"+server+":9000");
    ws.onopen = function() {
        console.log("WebSockets connection opened");
        var adminMsg = { "admin": [
            {"admin": true}
        ]};
        ws.send(JSON.stringify(adminMsg));
    };
    ws.onmessage = function(e) {
        //console.log("Got WebSockets message: " + e.data);
        console.log("Got WebSockets message:");
        console.log(e);
        //try {
            var json = JSON.parse(e.data);
            if (!handleMsg(json)){
                for(var i = 0, end = json.length; i < end; i++){
                    handleMsg(json[i]);
                }
            }
        // } catch (err) {
        //     console.log('This doesn\'t look like a valid JSON: ', e.data);
        //     return;
        // }
    };
    ws.onclose = function() {
        console.log("WebSockets connection closed");
    };
};

var clients = [];
var routes = [];

var handleMsg = function(json){
    if (json.name){
        handleNameMsg(json);
    } else if (json.config){
        handleConfigMsg(json);
    } else if (json.message){
        handleMessageMsg(json);
    } else if (json.route){
        handleRouteMsg(json);
    } else if (json.remove){
        handleRemoveMsg(json);
    } else if (json.admin){
        //do nothing
    } else {
        return false;
    }
    return true;
};

var handleMessageMsg = function(msg){
    for(var i = clients.length - 1; i >= 0; i--){
        if (clients[i].name === msg.message.clientName
            && clients[i].remoteAddress === msg.message.remoteAddress){
            var selector = "#client_list li:eq("+i+")";
            $(selector).addClass('active');
            setTimeout(function(){$(selector).removeClass('active');},200);
            break;
        }
    }
    // var selector2 = "input[name=pub][value='{name}_{addr}_{pubName}_{pubType}']:radio".replace("{name}",.Safetify()).replace("{addr}", msg.message.remoteAddress.Safetify()).replace("{pubName}",msg.message.name.Safetify()).replace("{pubType}",msg.message.type.Safetify());
    // $(selector2).parent().addClass('active');
    var func = getCommItem.bind(this, true, msg.message.clientName, msg.message.remoteAddress, msg.message.name, msg.message.type);
    func().addClass('active');
    setTimeout(function(){func().removeClass('active');},200);
};

var commSelectorTemplate = Handlebars.compile("{{pub}}_{{Safetify clientName}}_{{Safetify remoteAddress}}_{{Safetify name}}_{{Safetify type}}");
var getCommItem = function(a_bPublisher, a_sClientName, a_sRemoteAddress, a_sName, a_sType){
    return $("#"+getCommItemSelector.apply(this, arguments));
};

var getCommItemSelector = function(a_bPublisher, a_sClientName, a_sRemoteAddress, a_sName, a_sType){
    return commSelectorTemplate({ pub: (a_bPublisher?"pub":"sub"),
                                    clientName: a_sClientName,
                                    remoteAddress: a_sRemoteAddress,
                                    name: a_sName,
                                    type: a_sType});
};

var handleNameMsg = function(msg){
    for(var i = 0; i < msg.name.length; i++){
        var currClient = {name:msg.name[i].name, remoteAddress:msg.name[i].remoteAddress}
        clients.push(currClient);
        $("#client_list").append($(clientTemplate(currClient)));
    };
};

var routeTemplate;
routeTemplate = Handlebars.compile(document.getElementById( 'route_handlebar' ).textContent);
var clientTemplate;
clientTemplate = Handlebars.compile(document.getElementById( 'client_handlebar' ).textContent);
var pubsubTemplate;
pubsubTemplate = Handlebars.compile(document.getElementById( 'pubsub_handlebar' ).textContent);

var displayRoutes = function(){
    $("#route_list").html(routeTemplate({routes:routes}));
};

var addEndpoints = function(msg){
    var clientName = msg.config.name,
        remoteAddress = msg.config.remoteAddress,
        i,endpoint,currM,id;
    if (msg.config.publish && msg.config.publish.messages){
        i = msg.config.publish.messages.length;
        while (i--){
            currM = msg.config.publish.messages[i];
            id = getCommItemSelector(true, clientName, remoteAddress, currM.name, currM.type);
            endpoint = jsPlumb.addEndpoint(id, myPlumb.sourceEndpoint);
            myPlumb.endpoints[id] = endpoint;
        }
    }
    if (msg.config.subscribe && msg.config.subscribe.messages){
        i = msg.config.subscribe.messages.length;
        while(i--){
            currM = msg.config.subscribe.messages[i];
            id = getCommItemSelector(false, clientName, remoteAddress, currM.name, currM.type);
            endpoint = jsPlumb.addEndpoint(id, myPlumb.targetEndpoint);
            myPlumb.endpoints[id] = endpoint;
        }
    }
};

var handleConfigMsg = function(msg){
    for(var j = 0; j < clients.length; j++){
        if (clients[j].name === msg.config.name
            && clients[j].remoteAddress === msg.config.remoteAddress){
            clients[j].config = msg.config;
            $("#"+msg.config.name.Safetify()+"_"+msg.config.remoteAddress.Safetify()).children().children().append($(pubsubTemplate(clients[j])));
            addEndpoints(msg);
            break;
        }
    }
};

var removeClient = function(client){
    $("#"+client.name.Safetify()+"_"+client.remoteAddress.Safetify()).remove();
};

var addConnection = function(msg){
    var item = msg.route.publisher;
    var sourceid = getCommItemSelector(true, item.clientName, item.remoteAddress, item.name, item.type);
    item = msg.route.subscriber;
    var targetid = getCommItemSelector(false, item.clientName, item.remoteAddress, item.name, item.type);
    var source = myPlumb.endpoints[sourceid];
    var target = myPlumb.endpoints[targetid];
    var connection = jsPlumb.connect({source:source,target:target}, myPlumb.connectionParams);
    if (!myPlumb.connections[sourceid]){
        myPlumb.connections[sourceid] = {};
    }
    myPlumb.connections[sourceid][targetid] = connection;
};

var handleRouteMsg = function(msg){
    if (msg.route.type === 'add'){
        routes.push({publisher:msg.route.publisher,
                    subscriber:msg.route.subscriber});
        addConnection(msg);
    } else if (msg.route.type === 'remove'){
        for(var i = routes.length - 1; i >= 0; i--){
            var myPub = routes[i].publisher;
            var thePub = msg.route.publisher;
            var mySub = routes[i].subscriber;
            var theSub = msg.route.subscriber;
            if (myPub.clientName === thePub.clientName
                && myPub.name === thePub.name
                && myPub.type === thePub.type
                && myPub.remoteAddress === thePub.remoteAddress
                && mySub.clientName === theSub.clientName
                && mySub.name === theSub.name
                && mySub.type === theSub.type
                && mySub.remoteAddress === theSub.remoteAddress){
                routes.splice(i, 1);
            }
        }
    }
    displayRoutes();
};

var handleRemoveMsg = function(msg){
    //for each entry in the remove list
    //for each entry in the clients list
    //if the name & address match, then remove it from the list
    for(var i = 0; i < msg.remove.length; i++){
        for(var j = 0; j < clients.length; j++){
            if (clients[j].name === msg.remove[i].name
                && clients[j].remoteAddress === msg.remove[i].remoteAddress){
                removeClient(clients.splice(j, 1)[0]);
                break;
            }
        }
    }
};