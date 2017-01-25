//設定値
var DEFAULT_CENTER = {lat: 35.126679 , lng: 138.910641};
//var DEFAULT_CENTER = {lat: 35.366983 , lng: 136.617594};
var DEFAULT_SPEED = 3; // km/h
var MAX_SAMPO_POINT = 4; //4拠点
var TOILET_DISTANCE = 300;

//----- home ---------------------------------//
function changeBtnOK(frm) {
  console.log('changeBtnOK:'+frm.value);
  if (frm.value != "0") {
    $('#exebtn').removeAttr('disabled');
  } else {
    $('#exebtn').attr('disabled','disabled');
  }
}
function gotoMapTab(frm) {
  console.log('gotoMapTab');
  if ($(frm).hasClass('disabled')) return;//何もしない
  $('#t1').removeClass('active');
  $('#tab1').removeClass('active');
  $('#t2').addClass('active');
  $('#tab2').addClass('active');
  initMap();
}

//----- map ---------------------------------//
var map = null;
var center;
var directionsService;
var directionsDisplay;

var points = [];
var toilets = [];
var centerMaker = [];
var centerInfoWindow = [];
var marker = [];
var toiletsMarker = [];
var infoWindow = [];
var prepoint = -1;
var sanpoTime = 0;

//Google Mapの callback関数
function initMap() {
    $('#loading').show();
    //windowサイズに地図表示を合わせる
    console.log("window:height="+$(window).height());
    $('#map').height($(window).height()-98);
    clearMarkers();
    // geoの取得
  	if (!navigator.geolocation) {
        alert('Geolocation APIに対応していません');
        return false;
    }
    // 現在地の取得
    navigator.geolocation.getCurrentPosition(function(position) {
      //初期化
      if (directionsService == null) {
        directionsService = new google.maps.DirectionsService();
        directionsDisplay = new google.maps.DirectionsRenderer();
        directionsDisplay.setOptions({
        　suppressMarkers: true
        });
      }
      // 緯度経度の取得
      center = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      console.log("center:"+center);
      //データのロード
  		loadData();
    }, function() {
        alert('位置情報取得に失敗しました');
    });

}
//散歩ルートの再表示
function reroute() {
  routeMap();
}

//トイレの表示
function toilet(frm) {
  if (!frm.checked) {
    clearMarkers(MAX_SAMPO_POINT);//トイレのマーカーのみ消去する
    return;
  }
  //中心地・散歩地点から近いトイレを表示
  var pts = getToilet(center,TOILET_DISTANCE);
  for (var i=0; i<MAX_SAMPO_POINT; i++) {
    var arr = getToilet(marker[i].position,TOILET_DISTANCE);
    console.log("arr:"+arr.length);
    for (var j=0;j<arr.length;j++) {
      //console.log("arr:"+arr[j]);
      pts.push(arr[j]);
    }
  }
  console.log("pts:"+pts.length);
  //散歩地点
  for (var i=0; i<pts.length; i++) {
    //console.log("toilet"+i+"="+pts[i]["name"]);
    addMaker(i+MAX_SAMPO_POINT,pts[i]);
  }
}


//データの読み込み
function loadData(){
  //散歩時間の取得
  sanpoTime = $('#sanpoTime').val();
  console.log("sanpoTime:"+sanpoTime);
  if (sanpoTime == "0") return;
  //すでにロード済みの場合は散歩ルートを表示
  if (points != null && points.length > 0) {
    routeMap();
    return;
  }
  //地点データのロード
  $(function() {
    $.ajax({
      url: 'data/point.csv',
      cache: false,
      timeout:10000,
      success: successHandler,
      error: errorHandler
    });
  });
}
//ajax処理成功
function successHandler(data)
{
    console.log("通信成功");
    // csvを配列に格納
    var csvList = $.csv()(data);
    //1行目はヘッダーで項目のキーにする
    var header = csvList[0];
    var cnt = 0;
    // CSVデータを設定する
    for (var i = 1; i < csvList.length; i++) {
        var row = new Array();
        for (var j=0; j < header.length; j++) {//キーと値を対応付ける
          row[header[j]] = csvList[i][j];
        }
        //緯度経度に変換する
        row["point"] = new google.maps.LatLng({lat: parseFloat(row["lat"]), lng: parseFloat(row["lng"])});
        row["rowId"] = i;//行番号をセット
        //配列に設定指定する
        if (row["type"] == 'トイレ')　{
          toilets.push(row);
        } else {
          points.push(row);
        }
    }
    routeMap();//散歩ルートの表示
}
function errorHandler(XMLHttpRequest, textStatus, errorThrown)
{
    alert("通信失敗");
    console.log(XMLHttpRequest);
    console.log(textStatus);
    console.log(errorThrown);
    $('#loading').hide();
}

//散歩ルートを表示する
function routeMap() {
  console.log("routeMap:center="+center);
  //散歩時間から距離を計算する
  var distance = calcDistance(sanpoTime);
  //距離の範囲にある登録されている地点を取得
  var sampoPoints = getSampoPoints(center,distance);
  if (sampoPoints.length == 0) {
    message("現在地からは散歩場所が取得できません。<br>スタート位置を変更します");
    center = new google.maps.LatLng(DEFAULT_CENTER);
    console.log("routeMap:center="+center);
    sampoPoints = getSampoPoints(center,distance);
  }
  //散歩地点をランダムに変更
  sampoPoints = shuffle(sampoPoints);
  //最大地点数を超えている場合は削除
  if (sampoPoints.length > MAX_SAMPO_POINT) sampoPoints.splice(0,sampoPoints.length-MAX_SAMPO_POINT);
  //中心位置と散歩場所をマップに表示
  viewMap(sampoPoints);
  //散歩ルートを地図に描画
  getSampoRoute(center, center, sampoPoints);
  //ロード完了
  $('#loading').hide();
}

//散歩地点を取得する
function getSampoPoints(loc,distance) {
  console.log("points:"+points.length+" loc:"+loc+" distance:"+distance);
  return getPoints(loc,distance,points);
}
//トイレ地点を取得する
function getToilet(loc,distance) {
  console.log("getToilet:"+toilets.length+" loc:"+loc+" distance:"+distance);
  return getPoints(loc,distance,toilets);
}
function getPoints(loc,distance,list) {
  var arr = [];
  if (!distance) return arr;
  for (var i = 0; i<list.length; i++) {
    var row = list[i];
    if (!isOkDistance(row["point"],loc,distance)) continue;//読み飛ばし
    //console.log(distance+"m OK name="+row["name"]+" type="+row["type"]);
    arr.push(row);
  }
  return arr;
}

//散歩距離の計算
function calcDistance(time) {
  var speed = DEFAULT_SPEED * 1000 / 60 //時速 →　分速
  //var params = getParameter();
  //var minutes = (params["sanpoTime"] != NaN) ? parseInt(params["sanpoTime"]) : 60 ;
  var minutes = (time != NaN) ? parseInt(time) : 60 ;
  var distance = speed * minutes / (MAX_SAMPO_POINT); //往復を考えて距離を半分にする
  return distance;
}

//------------------------------------------//
//共通部品
//------------------------------------------//
//メッセージ
function message(msg) {
  //alert(msg);//TODO　変更予定
  $('#msg').children("span").html(msg);
  $('#msg').show();
  setTimeout(function(){
      $('#msg').hide();
  },3000);
}
//引数の取得
function getParameter() {
  var strprm = $(location).attr('search');
  //先頭の?を除去し、&で分割
  //console.log("strprm="+strprm);
  var params = strprm.substring(1).split('&');
  var ret = new Array();
  for (var i=0;i<params.length;i++) {
    var val = params[i].split('=');
    ret[val[0]] = val[1];
  }
  return ret;
}
//配列をランダムに変更
function shuffle(array) {
  var n = array.length, t, i;
  while (n) {
    i = Math.floor(Math.random() * n--);
    t = array[n];
    array[n] = array[i];
    array[i] = t;
  }
  return array;
}
//四捨五入
function round(n,s){
  return Math.round(n*Math.pow(10,s))/Math.pow(10,s);
}
//------------------------------------------//
//地図部品
//------------------------------------------//

//地図の描画
function viewMap(sampoPoints) {
  if (map == null) {
    console.log("map init");
    // 地図の作成
    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        zoom: 14
    });
    // マーカーのドロップ（ドラッグ終了）時のイベント
	  // google.maps.event.addListener( centerMaker, 'dragend', function(ev){
    //   center = ev.latLng;//中心位置を変更
    //   console.log("center:"+center);
	  // });
  }
  //センターマーカーの初期化
  initCenterMarker();
  //散歩場所のアイコンを表示
  clearMarkers();
  for (var i=0;i<sampoPoints.length;i++) {
    addMaker(i,sampoPoints[i]);
  }
}

//センターマーカーの初期化
function initCenterMarker() {
  console.log('initCenterMarker:'+centerMaker.length);
  if (centerMaker.length == 0) {
    // 現在位置マーカーの追加
    centerMaker = new google.maps.Marker({
        position: center,
        icon : toCenterIcon(), //中心マーカー
        draggable: true,       // ドラッグ可能にする
        map: map
    });
  }
  console.log("centerMaker:"+centerMaker.position);
  centerMaker.setPosition(center);
  centerMaker.setMap(map);
  centerInfoWindow = new google.maps.InfoWindow({ // 吹き出しの追加
    content: '好きな場所にドラッグ&ドロップしてリルートしてね' // 吹き出しに表示する内容
  });
  centerMaker.addListener('dragstart', function(ev) { // マーカーをクリックしたとき
    centerInfoWindow.open(map, centerMaker); // 吹き出しの表示
  });
  centerMaker.addListener('dragend', function(ev) { // マーカーをクリックしたとき
    centerInfoWindow.close(); // 吹き出しの表示
    center = ev.latLng;//中心位置を変更
    console.log("center:"+center);
  });
}

//マーカーの削除
function clearMarkers(pst) {
  if (!pst) pst = 0;
  for (var i = pst; i < marker.length; i++) {
     marker[i].setMap(null);
  }
  if (pst == 0) {
    marker = [];
    infoWindow = [];
    prepoint = -1;
  }
}
//マーカーを追加する
function addMaker(idx,row) {
  //console.log("addMaker:"+idx+" name="+row["name"]+" point="+row["point"]);
  //マーカー
  marker[idx] = new google.maps.Marker({
    position: row["point"],
    map: map,
    icon: toIcon(row),//ピンのアイコン
    title: row["name"]
  });
  //タップ時の情報を表示
  var context =   '<div>'+row["name"]+'</div>'
    + '<div>'+row["attribute"]+'</div>'
    + '<div>'+row["time"]+'</div>'
    //+ '<span id="distance'+idx+'"></span>Km '
    ;
  infoWindow[idx] = new google.maps.InfoWindow({ // 吹き出しの追加
    content: context // 吹き出しに表示する内容
  });
  //
  markerEvent(idx);
}
//中心マーカー
function toCenterIcon() {
  var pin_mishimaru = {
    url: 'images/th_mishimaru.png',
    size: new google.maps.Size(54, 82),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(54, 82)
  };
  return pin_mishimaru;
}
//ピンの色を変える
function toIcon(row) {
  var pin_blue = {
    url: 'images/th_point.png',
    size: new google.maps.Size(48, 48),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(0, 0)
  };
  var pin_red = {
    url: 'images/th_toilet.png',
    size: new google.maps.Size(48, 48),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(0, 0)
  };
  var pin_gray = {
    url: 'images/th_flower.png',
    size: new google.maps.Size(48, 48),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(0, 0)
  };
  //ピンの色を判断
  var pin = pin_blue;
  if (row["type"] == "トイレ") {
  	pin = pin_red;
  } else if (row["type"] == "花壇") {
  	pin = pin_gray;
  }
  return pin;
}
// マーカーにクリックイベントを追加
function markerEvent(i) {
    marker[i].addListener('click', function() { // マーカーをクリックしたとき
      if (prepoint >= 0) {
        infoWindow[prepoint].close();//前のWindowを閉じる
      }
      infoWindow[i].open(map, marker[i]); // 吹き出しの表示
      prepoint = i;
    });
}
//散歩の経由ルートを取得
function getSampoRoute(org,dst,sampoPoints) {
  var waypts = [];
  for (var i=0; i<sampoPoints.length; i++) {
    waypts.push({
      location:sampoPoints[i]["point"],
      stopover:true
    });
  }
  var request = {
    waypoints:waypts,
    optimizeWaypoints:true,
    origin: org, //入力地点の緯度、経度
    destination: dst, //到着地点の緯度、経度
    travelMode: google.maps.DirectionsTravelMode.WALKING //ルートの種類
  }
  directionsService.route(request,function(result, status){
    toRender(result);
    //移動距離をセット
    var distance = getDistanceKm(result.routes[0].legs);
    $("#distance").text(distance);
    //所用時間（分）をセット
    var minutes = round(distance/DEFAULT_SPEED*60,1);
    $("#time").text(minutes);

  });
}
function toRender(result){
    directionsDisplay.setDirections(result); //取得した情報をset
    directionsDisplay.setMap(map); //マップに描画
}
//移動距離を計算
function getDistanceKm(legs) {
	var journey = 0;
    for (var i in legs) {
        journey += legs[i].distance.value;
    }
    return round(journey/1000,1);
}
//中心位置からの指定された距離に含まれる地点を判断する
function isOkDistance(point,center,distance) {
  //console.log(distance+"m point="+point+" lat="+Math.abs(point.lat() - center.lat())+" lng="+Math.abs(point.lng() - center.lng()));
  var R = 6378150; //地球の半径
  //緯度の範囲を計算
  var lat = 180 / (Math.PI * R) * distance;
  if (Math.abs(point.lat() - center.lat()) > lat ) {
    return false
  };
  //経度の範囲を計算
  var lng = 180 / (Math.PI * R * Math.cos((center.lat() / 180) * Math.PI)) * distance;
  if (Math.abs(point.lng() - center.lng()) > lng ) {
    return false
  };
  return true;
}
//-------------------------------------------------------//
