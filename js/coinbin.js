$(document).ready(function() {

  /* open wallet code */
  var explorer_addr = "https://rvn.traysi.org/address/"
  var wallet_timer = false;

  $("#openBtn").click(function(){
    var email = $("#openUsername").val().toLowerCase();
    if(email.match(/[\s\w\d]/g)){
      if($("#openPass").val().length>=4){
        if($("#openPass").val()==$("#openPassConfirm").val()){
          var email = $("#openUsername").val().toLowerCase();
          var pass = $("#openPass").val();
          var s = email;
          s += '|'+pass+'|';
          s += s.length+'|!@'+((pass.length*7)+email.length)*7;
          var regchars = (pass.match(/[a-z]+/g)) ? pass.match(/[a-z]+/g).length : 1;
          var regupchars = (pass.match(/[A-Z]+/g)) ? pass.match(/[A-Z]+/g).length : 1;
          var regnums = (pass.match(/[0-9]+/g)) ? pass.match(/[0-9]+/g).length : 1;
          s += ((regnums+regchars)+regupchars)*pass.length+'3571';
          s += (s+''+s);

          for(i=0;i<=50;i++){
            s = Crypto.SHA256(s);
          }

          coinjs.compressed = true;
          var keys = coinjs.newKeys(s);
          var address = keys.address;
          var wif = keys.wif;
          var pubkey = keys.pubkey;
          var privkeyaes = CryptoJS.AES.encrypt(keys.wif, pass);

          $("#walletAddress").html(address);
          $("#walletHistory").attr('href',explorer_addr+address);

          $("#walletQrCode").html("");
          var qrcode = new QRCode("walletQrCode");
          qrcode.makeCode("rvn:"+address);

          $("#walletKeys .privkey").val(wif);
          $("#walletKeys .pubkey").val(pubkey);
          $("#walletKeys .privkeyaes").val(privkeyaes);

          $("#openLogin").hide();
          $("#openWallet").removeClass("hidden").show();

          walletBalance();
          checkBalanceLoop();
        } else {
          $("#openLoginStatus").html("Your passwords do not match!").removeClass("hidden").fadeOut().fadeIn();
        }
      } else {
        $("#openLoginStatus").html("Your password must be at least 10 chars long").removeClass("hidden").fadeOut().fadeIn();
      }
    } else {
      $("#openLoginStatus").html("Your email address doesn't appear to be valid").removeClass("hidden").fadeOut().fadeIn();
    }

    $("#openLoginStatus").prepend('<span class="glyphicon glyphicon-exclamation-sign"></span> ');
  });

  $("#walletLogout").click(function(){
    $("#openUsername").val("");
    $("#openPass").val("");
    $("#openPassConfirm").val("");

    $("#openLogin").show();
    $("#openWallet").addClass("hidden").show();

    $("#walletAddress").html("");
    $("#walletHistory").attr('href',explorer_addr);

    $("#walletQrCode").html("");
    var qrcode = new QRCode("walletQrCode");
    qrcode.makeCode("rvn:");

    $("#walletKeys .privkey").val("");
    $("#walletKeys .pubkey").val("");

    $("#openLoginStatus").html("").hide();
  });

  $("#walletShowKeys").click(function(){
    $("#walletKeys").removeClass("hidden");
    $("#walletSpend").removeClass("hidden").addClass("hidden");
  });

  $("#walletBalance").click(function(){
    walletBalance();
  });

  $("#walletConfirmSend").click(function(){

    $("#walletSendConfirmStatus").removeClass('hidden').addClass('alert-info').html("Transaction is submitting. Please wait");    
    $("#sendBtnLoader").removeClass("hidden");

    var thisbtn = $(this);
    var tx = coinjs.transaction();
    var txfee = $("#txFee");

    var total = (txfee.val()*1);
console.log(total);

    $.each($("#walletSpendTo .output"), function(i,o){
      var addr = $('.addressTo',o);
      var amount = $('.amount',o);
      if(amount.val()*1>0){
        total += amount.val()*1;
        tx.addoutput(addr.val(), amount.val()*1);
      }
    });
console.log("Finished wallet spend");

    thisbtn.attr('disabled',true);

    var script = false;

    var sequence = false;

    tx.addUnspent($("#walletAddress").html(), total, function(data){
console.log("Going into tx.addUnspent"+data.value);

      var dvalue = (data.value).toFixed(8) * 1;
console.log("Value: "+dvalue);
      total = (total*1).toFixed(8) * 1;

      if(dvalue>=total){
        var change = dvalue-total;
        if((change*1)>0){
          tx.addoutput($("#walletAddress").html(), change);
        }

        // clone the transaction with out using coinjs.clone() function as it gives us trouble
        var tx2 = coinjs.transaction(); 
        var txunspent = tx2.deserialize(tx.serialize());

        // then sign
        var signed = txunspent.sign($("#walletKeys .privkey").val());

        // and finally broadcast!
        tx2.broadcast(function(data){
          
          $("#sendBtnLoader").addClass("hidden");
          
          if(data.result=="1"){
            $("#walletSendConfirmStatus").removeClass('hidden').removeClass('alert-danger').addClass('alert-success').html('Successfully sent - '+data.txid);
            if( (data.txid == '') || (data.txid == '0') || (data.txid == 0) )
            {
              $("#walletSendConfirmStatus").removeClass('hidden').addClass('alert-danger').html("There is an error during transaction");
              $("#walletSendFailTransaction").removeClass('hidden');
              $("#walletSendFailTransaction textarea").val(signed);
            }

            $("#walletSendFailTransaction").addClass('hidden');
            thisbtn.attr('disabled',true);
          } else {
            $("#walletSendConfirmStatus").removeClass('hidden').addClass('alert-danger').html("There is an error during transaction");
            $("#walletSendFailTransaction").removeClass('hidden');
            $("#walletSendFailTransaction textarea").val(signed);
            thisbtn.attr('disabled',false);
          }

          // update wallet balance
          walletBalance();

        }, signed);
      } else {
        $("#walletSendConfirmStatus").removeClass("hidden").addClass('alert-danger').html("You have a confirmed balance of "+dvalue+" RVN unable to send "+total+" RVN").fadeOut().fadeIn();
        thisbtn.attr('disabled',false);
      }

      $("#walletLoader").addClass("hidden");

    }, script, script, sequence);
  });

  $("#walletResetBtn").click(function(){
    $(".addressTo").val('');
    $(".amount").val('');
    $("#txFee").val('0.001');


  });

  $("#walletSendBtn").click(function(){

    $("#walletSendFailTransaction").addClass('hidden');
    $("#walletSendStatus").addClass("hidden").html("");

    $("#sendBtnLoader").removeClass('hidden');
    $("#walletConfirmSend").attr('disabled',true);

    var thisbtn = $(this);
    var txfee = $("#txFee");

    if((!isNaN(txfee.val())) && txfee.val()>=0){
      $(txfee).parent().removeClass('has-error');
    } else {
      $(txfee).parent().addClass('has-error');
    }

    var total = (txfee.val()*1);

    $.each($("#walletSpendTo .output"), function(i,o){
      var amount = $('.amount',o);
      var address = $('.addressTo',o);

      total += amount.val()*1;

      if((!isNaN($(amount).val())) && $(amount).val()>0){
        $(amount).parent().removeClass('has-error');
      } else {
        $(amount).parent().addClass('has-error');      
      }

      if(coinjs.addressDecode($(address).val())){
        $(address).parent().removeClass('has-error');
      } else {
        $(address).parent().addClass('has-error');
      }
    });

    total = total.toFixed(8);

    if($("#walletSpend .has-error").length==0){
      var balance = ($("#walletBalance").html()).replace(/[^0-9\.]+/g,'')*1;
      if(total<=balance){
        $("#walletSendConfirmStatus").addClass("hidden").removeClass('alert-success').removeClass('alert-danger').html("");
        $("#recipient_addr").html($(".addressTo").val());
        $("#spendAmount").html(total);
        $("#modalWalletConfirm").modal("show");
        setTimeout('$("#walletConfirmSend").attr("disabled",false); $("#sendBtnLoader").addClass("hidden");', 2000);        
      } else {
        $("#walletSendStatus").removeClass("hidden").html("You are trying to spend "+total+' but have a balance of '+balance);
      }
    } else {
      $("#walletSpend .has-error").fadeOut().fadeIn();
      $("#walletSendStatus").removeClass("hidden").html('<span class="glyphicon glyphicon-exclamation-sign"></span> One or more input has an error');
    }
  });

  $("#walletShowSpend").click(function(){
    $("#walletSpend").removeClass("hidden");
    $("#walletKeys").removeClass("hidden").addClass("hidden");
  });

  $("#walletSpendTo .addressAdd").click(function(){
    var clone = '<div class="form-horizontal output">'+$(this).parent().html()+'</div>';
    $("#walletSpendTo").append(clone);
    $("#walletSpendTo .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
    $("#walletSpendTo .glyphicon-minus:last").parent().removeClass('addressAdd').addClass('addressRemove');
    $("#walletSpendTo .addressRemove").unbind("");
    $("#walletSpendTo .addressRemove").click(function(){
      $(this).parent().fadeOut().remove();
    });
  });

  function walletBalance() {
    $("#walletLoader").removeClass("hidden");
        var address = $("#walletAddress").html();
    $.ajax ({
      type: "GET",
      url: "/get.php?addy="+address+"",
      dataType: "json",
      error: function() {},
      complete: function(data, status) {
                if (!isNaN(data.responseText))
                    $("#walletBalance").html(data.responseText+" RVN"); 
                else
                    $("#walletBalance").html("0.00 RVN"); 
        $("#walletLoader").addClass("hidden");
                console.log(data);
      }
    });
  }

  function checkBalanceLoop(){
    clearTimeout(wallet_timer);
    wallet_timer = setTimeout(function(){
      if($("#walletLoader").hasClass("hidden")){
        walletBalance();
      }
      checkBalanceLoop();
    },45000);
  }

  /* new -> address code */

  $("#newKeysBtn").click(function(){
    coinjs.compressed = false;
    if($("#newCompressed").is(":checked")){
      coinjs.compressed = true;
    }
    var s = ($("#newBrainwallet").is(":checked")) ? $("#brainwallet").val() : null;
    var coin = coinjs.newKeys(s);
    $("#newBitcoinAddress").val(coin.address);
    $("#newPubKey").val(coin.pubkey);
    $("#newPrivKey").val(coin.wif);

    /* encrypted key code */
    if((!$("#encryptKey").is(":checked")) || $("#aes256pass").val()==$("#aes256pass_confirm").val()){
      $("#aes256passStatus").addClass("hidden");
      if($("#encryptKey").is(":checked")){
        $("#aes256wifkey").removeClass("hidden");
      }
    } else {
      $("#aes256passStatus").removeClass("hidden");
    }
    $("#newPrivKeyEnc").val(CryptoJS.AES.encrypt(coin.wif, $("#aes256pass").val())+'');

  });

  $("#newBrainwallet").click(function(){
    if($(this).is(":checked")){
      $("#brainwallet").removeClass("hidden");
    } else {
      $("#brainwallet").addClass("hidden");
    }
  });

  $("#encryptKey").click(function(){
    if($(this).is(":checked")){
      $("#aes256passform").removeClass("hidden");
    } else {
      $("#aes256wifkey, #aes256passform, #aes256passStatus").addClass("hidden");
    }
  });

  /* new -> multisig code */

  $("#newMultiSigAddress").click(function(){

    $("#multiSigData").removeClass('show').addClass('hidden').fadeOut();
    $("#multisigPubKeys .pubkey").parent().removeClass('has-error');
    $("#releaseCoins").parent().removeClass('has-error');
    $("#multiSigErrorMsg").hide();

    if((isNaN($("#releaseCoins option:selected").html())) || ((!isNaN($("#releaseCoins option:selected").html())) && ($("#releaseCoins option:selected").html()>$("#multisigPubKeys .pubkey").length || $("#releaseCoins option:selected").html()*1<=0 || $("#releaseCoins option:selected").html()*1>8))){
      $("#releaseCoins").parent().addClass('has-error');
      $("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Minimum signatures required is greater than the amount of public keys provided').fadeIn();
      return false;
    }

    var keys = [];
    $.each($("#multisigPubKeys .pubkey"), function(i,o){
      if(coinjs.pubkeydecompress($(o).val())){
        keys.push($(o).val());
        $(o).parent().removeClass('has-error');
      } else {
        $(o).parent().addClass('has-error');
      }
    });

    if(($("#multisigPubKeys .pubkey").parent().hasClass('has-error')==false) && $("#releaseCoins").parent().hasClass('has-error')==false){
      var sigsNeeded = $("#releaseCoins option:selected").html();
      var multisig =  coinjs.pubkeys2MultisigAddress(keys, sigsNeeded);
      if(multisig.size <= 520){
        $("#multiSigData .address").val(multisig['address']);
        $("#multiSigData .script").val(multisig['redeemScript']);
        $("#multiSigData .scriptUrl").val(document.location.origin+''+document.location.pathname+'?verify='+multisig['redeemScript']+'#verify');
        $("#multiSigData").removeClass('hidden').addClass('show').fadeIn();
        $("#releaseCoins").removeClass('has-error');
      } else {
        $("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Your generated redeemscript is too large (>520 bytes) it can not be used safely').fadeIn();
      }
    } else {
      $("#multiSigErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> One or more public key is invalid!').fadeIn();
    }
  });

  $("#multisigPubKeys .pubkeyAdd").click(function(){
    if($("#multisigPubKeys .pubkeyRemove").length<14){
      var clone = '<div class="form-horizontal">'+$(this).parent().html()+'</div>';
      $("#multisigPubKeys").append(clone);
      $("#multisigPubKeys .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
      $("#multisigPubKeys .glyphicon-minus:last").parent().removeClass('pubkeyAdd').addClass('pubkeyRemove');
      $("#multisigPubKeys .pubkeyRemove").unbind("");
      $("#multisigPubKeys .pubkeyRemove").click(function(){
        $(this).parent().fadeOut().remove();
      });
    }
  });

  $("#mediatorList").change(function(){
    var data = ($(this).val()).split(";");
    $("#mediatorPubkey").val(data[0]);
    $("#mediatorEmail").val(data[1]);
    $("#mediatorFee").val(data[2]);
  }).change();

  $("#mediatorAddKey").click(function(){
    var count = 0;
    var len = $(".pubkeyRemove").length;
    if(len<14){
      $.each($("#multisigPubKeys .pubkey"),function(i,o){
        if($(o).val()==''){
          $(o).val($("#mediatorPubkey").val()).fadeOut().fadeIn();
          $("#mediatorClose").click();
          return false;
        } else if(count==len){
          $("#multisigPubKeys .pubkeyAdd").click();
          $("#mediatorAddKey").click();
          return false;
        }
        count++;
      });

      $("#mediatorClose").click();
    }
  });

  /* new -> time locked code */

  $('#timeLockedDateTimePicker').datetimepicker({
    format: "MM/DD/YYYY HH:mm",
  });
  
  $('#timeLockedRbTypeBox input').change(function(){
    if ($('#timeLockedRbTypeDate').is(':checked')){
      $('#timeLockedDateTimePicker').show();
      $('#timeLockedBlockHeight').hide();
    } else {
      $('#timeLockedDateTimePicker').hide();
      $('#timeLockedBlockHeight').removeClass('hidden').show();
    }
  });

    $("#newTimeLockedAddress").click(function(){

        $("#timeLockedData").removeClass('show').addClass('hidden').fadeOut();
        $("#timeLockedPubKey").parent().removeClass('has-error');
        $("#timeLockedDateTimePicker").parent().removeClass('has-error');
        $("#timeLockedErrorMsg").hide();

        if(!coinjs.pubkeydecompress($("#timeLockedPubKey").val())) {
          $('#timeLockedPubKey').parent().addClass('has-error');
        }

        var nLockTime = -1;

        if ($('#timeLockedRbTypeDate').is(':checked')){
          // by date
          var date = $('#timeLockedDateTimePicker').data("DateTimePicker").date();
          if(!date || !date.isValid()) {
            $('#timeLockedDateTimePicker').parent().addClass('has-error');
          }
          nLockTime = date.unix()
          if (nLockTime < 500000000) {
            $('#timeLockedDateTimePicker').parent().addClass('has-error');
          }
        } else {
      nLockTime = parseInt($('#timeLockedBlockHeightVal').val(), 10);
          if (nLockTime >= 500000000) {
            $('#timeLockedDateTimePicker').parent().addClass('has-error');
          }
        }

        if(($("#timeLockedPubKey").parent().hasClass('has-error')==false) && $("#timeLockedDateTimePicker").parent().hasClass('has-error')==false){
          try {
              var hodl = coinjs.simpleHodlAddress($("#timeLockedPubKey").val(), nLockTime);
              $("#timeLockedData .address").val(hodl['address']);
              $("#timeLockedData .script").val(hodl['redeemScript']);
              $("#timeLockedData .scriptUrl").val(document.location.origin+''+document.location.pathname+'?verify='+hodl['redeemScript']+'#verify');
              $("#timeLockedData").removeClass('hidden').addClass('show').fadeIn();
          } catch(e) {
            $("#timeLockedErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> ' + e).fadeIn();
          }
        } else {
            $("#timeLockedErrorMsg").html('<span class="glyphicon glyphicon-exclamation-sign"></span> Public key and/or date is invalid!').fadeIn();
        }
    });

  /* new -> Hd address code */

  $(".deriveHDbtn").click(function(){
    $("#verifyScript").val($("input[type='text']",$(this).parent().parent()).val());
    window.location = "#verify";
    $("#verifyBtn").click();
  });

  $("#newHDKeysBtn").click(function(){
    coinjs.compressed = true;
    var s = ($("#newHDBrainwallet").is(":checked")) ? $("#HDBrainwallet").val() : null;
    var hd = coinjs.hd();
    var pair = hd.master(s);
    $("#newHDxpub").val(pair.pubkey);
    $("#newHDxprv").val(pair.privkey);

  });

  $("#newHDBrainwallet").click(function(){
    if($(this).is(":checked")){
      $("#HDBrainwallet").removeClass("hidden");
    } else {
      $("#HDBrainwallet").addClass("hidden");
    }
  });

  /* new -> transaction code */

  $("#recipients .addressAddTo").click(function(){
    if($("#recipients .addressRemoveTo").length<19){
      var clone = '<div class="row recipient"><br>'+$(this).parent().parent().html()+'</div>';
      $("#recipients").append(clone);
      $("#recipients .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
      $("#recipients .glyphicon-minus:last").parent().removeClass('addressAdd').addClass('addressRemoveTo');
      $("#recipients .addressRemoveTo").unbind("");
      $("#recipients .addressRemoveTo").click(function(){
        $(this).parent().parent().fadeOut().remove();
        validateOutputAmount();
      });
      validateOutputAmount();
    }
  });

  $("#inputs .txidAdd").click(function(){
    var clone = '<div class="row inputs"><br>'+$(this).parent().parent().html()+'</div>';
    $("#inputs").append(clone);
    $("#inputs .txidClear:last").remove();
    $("#inputs .glyphicon-plus:last").removeClass('glyphicon-plus').addClass('glyphicon-minus');
    $("#inputs .glyphicon-minus:last").parent().removeClass('txidAdd').addClass('txidRemove');
    $("#inputs .txidRemove").unbind("");
    $("#inputs .txidRemove").click(function(){
      $(this).parent().parent().fadeOut().remove();
      totalInputAmount();
    });
    $("#inputs .row:last input").attr('disabled',false);

    $("#inputs .txIdAmount").unbind("").change(function(){
      totalInputAmount();
    }).keyup(function(){
      totalInputAmount();
    });

  });

  $("#transactionBtn").click(function(){
    var tx = coinjs.transaction();
    var estimatedTxSize = 10; // <4:version><1:txInCount><1:txOutCount><4:nLockTime>

    $("#transactionCreate, #transactionCreateStatus").addClass("hidden");

    if(($("#nLockTime").val()).match(/^[0-9]+$/g)){
      tx.lock_time = $("#nLockTime").val()*1;
    }

    $("#inputs .row").removeClass('has-error');

    $('#putTabs a[href="#txinputs"], #putTabs a[href="#txoutputs"]').attr('style','');

    $.each($("#inputs .row"), function(i,o){
      if(!($(".txId",o).val()).match(/^[a-f0-9]+$/i)){
        $(o).addClass("has-error");
      } else if((!($(".txIdScript",o).val()).match(/^[a-f0-9]+$/i)) && $(".txIdScript",o).val()!=""){
        $(o).addClass("has-error");
      } else if (!($(".txIdN",o).val()).match(/^[0-9]+$/i)){
        $(o).addClass("has-error");
      }

      if(!$(o).hasClass("has-error")){
        var seq = null;

        var currentScript = $(".txIdScript",o).val();
        if (currentScript.match(/^76a914[0-9a-f]{40}88ac$/)) {
          estimatedTxSize += 147
        } else if (currentScript.match(/^5[1-9a-f](?:210[23][0-9a-f]{64}){1,15}5[1-9a-f]ae$/)) {
          // <74:persig <1:push><72:sig><1:sighash> ><34:perpubkey <1:push><33:pubkey> > <32:prevhash><4:index><4:nSequence><1:m><1:n><1:OP>
          var scriptSigSize = (parseInt(currentScript.slice(1,2),16) * 74) + (parseInt(currentScript.slice(-3,-2),16) * 34) + 43
          // varint 2 bytes if scriptSig is > 252
          estimatedTxSize += scriptSigSize + (scriptSigSize > 252 ? 2 : 1)
        } else {
          // underestimating won't hurt. Just showing a warning window anyways.
          estimatedTxSize += 147
        }

        tx.addinput($(".txId",o).val(), $(".txIdN",o).val(), $(".txIdScript",o).val(), seq);
      } else {
        $('#putTabs a[href="#txinputs"]').attr('style','color:#a94442;');
      }
    });

    $("#recipients .row").removeClass('has-error');

    $.each($("#recipients .row"), function(i,o){
      var a = ($(".address",o).val());
      var ad = coinjs.addressDecode(a);
      if(((a!="") && (ad.version == coinjs.pub || ad.version == coinjs.multisig)) && $(".amount",o).val()!=""){ // address
        // P2SH output is 32, P2PKH is 34
        estimatedTxSize += (ad.version == coinjs.pub ? 34 : 32)
        tx.addoutput(a, $(".amount",o).val());
      } else if (((a!="") && ad.version === 42) && $(".amount",o).val()!=""){ // stealth address
        // 1 P2PKH and 1 OP_RETURN with 36 bytes, OP byte, and 8 byte value
        estimatedTxSize += 78
        tx.addstealth(ad, $(".amount",o).val());
      } else if (((($("#opReturn").is(":checked")) && a.match(/^[a-f0-9]+$/ig)) && a.length<160) && (a.length%2)==0) { // data
        estimatedTxSize += (a.length / 2) + 1 + 8
        tx.adddata(a);
      } else { // neither address nor data
        $(o).addClass('has-error');
        $('#putTabs a[href="#txoutputs"]').attr('style','color:#a94442;');
      }
    });


    if(!$("#recipients .row, #inputs .row").hasClass('has-error')){
      
      $("#transactionCreate textarea").val(tx.serialize());
      $("#transactionCreate .txSize").html(tx.size());

      if($("#feesestnewtx").attr('est')=='y'){
        $("#fees .txhex").val($("#transactionCreate textarea").val());
        $("#analyseBtn").click();
        $("#fees .txhex").val("");
        window.location = "#fees";
      } else {

        $("#transactionCreate").removeClass("hidden");

        // Check fee against hard 0.01 as well as fluid 200 satoshis per byte calculation.
        if($("#transactionFee").val()>=0.01 || $("#transactionFee").val()>= estimatedTxSize * 200 * 1e-8){
          $("#modalWarningFeeAmount").html($("#transactionFee").val());
          $("#modalWarningFee").modal("show");
        }
      }
      $("#feesestnewtx").attr('est','');
    } else {
      $("#transactionCreateStatus").removeClass("hidden").html("One or more input or output is invalid").fadeOut().fadeIn();
    }
  });

  $("#feesestnewtx").click(function(){
    $(this).attr('est','y');
    $("#transactionBtn").click();
  });

  $("#feesestwallet").click(function(){
    $(this).attr('est','y');
    var outputs = $("#walletSpendTo .output").length;

    $("#fees .inputno, #fees .outputno, #fees .bytes").html(0);
    $("#fees .slider").val(0);

    var tx = coinjs.transaction();
    tx.listUnspent($("#walletAddress").html(), function(data){
      var inputs = $(data).find("unspent").children().length;
      $("#fees .txi_regular").val(inputs);
      $("#fees .txi_regular").trigger('input');

      $.each($("#walletSpendTo .output"), function(i,o){
        var addr = $('.addressTo',o);
        var ad = coinjs.addressDecode(addr.val());
        if (ad.version == coinjs.multisig){ // p2sh
          $("#fees .txo_p2sh").val(($("#fees .txo_p2sh").val()*1)+1);
          $("#fees .txo_p2sh").trigger('input');
        } else { // p2pkh
          $("#fees .txo_p2pkh").val(($("#fees .txo_p2pkh").val()*1)+1);
          $("#fees .txo_p2pkh").trigger('input');          
        }
      });


    });

    //feeStats();
    window.location = "#fees";
  });

  $(".txidClear").click(function(){
    $("#inputs .row:first input").attr('disabled',false);
    $("#inputs .row:first input").val("");
    totalInputAmount();
  });

  $("#inputs .txIdAmount").unbind("").change(function(){
    totalInputAmount();
  }).keyup(function(){
    totalInputAmount();
  });

  $("#donateTxBtn").click(function(){

    var exists = false;

    if(!exists){
      if($("#recipients .recipient:last .address:last").val() != ""){
        $("#recipients .addressAddTo:first").click();
      };

      return true;
    }
  });

  /* code for the qr code scanner */

  $(".qrcodeScanner").click(function(){
    if ((typeof MediaStreamTrack === 'function') && typeof MediaStreamTrack.getSources === 'function'){
      MediaStreamTrack.getSources(function(sourceInfos){
        var f = 0;
        $("select#videoSource").html("");
        for (var i = 0; i !== sourceInfos.length; ++i) {
          var sourceInfo = sourceInfos[i];
          var option = document.createElement('option');
          option.value = sourceInfo.id;
          if (sourceInfo.kind === 'video') {
            option.text = sourceInfo.label || 'camera ' + ($("select#videoSource options").length + 1);
            $(option).appendTo("select#videoSource");
           }
        }
      });

      $("#videoSource").unbind("change").change(function(){
        scannerStart()
      });

    } else {
      $("#videoSource").addClass("hidden");
    }
    scannerStart();
    $("#qrcode-scanner-callback-to").html($(this).attr('forward-result'));
  });

  function scannerStart(){
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || false;
    if(navigator.getUserMedia){
      if (!!window.stream) {
        $("video").attr('src',null);
        window.stream.stop();
        }

      var videoSource = $("select#videoSource").val();
      var constraints = {
        video: {
          optional: [{sourceId: videoSource}]
        }
      };

      navigator.getUserMedia(constraints, function(stream){
        window.stream = stream; // make stream available to console
        var videoElement = document.querySelector('video');
        videoElement.src = window.URL.createObjectURL(stream);
        videoElement.play();
      }, function(error){ });

      QCodeDecoder().decodeFromCamera(document.getElementById('videoReader'), function(er,data){
        if(!er){
          var match = data.match(/^bitcoin\:([13][a-z0-9]{26,33})/i);
          var result = match ? match[1] : data;
          $(""+$("#qrcode-scanner-callback-to").html()).val(result);
          $("#qrScanClose").click();
        }
      });
    } else {
      $("#videoReaderError").removeClass("hidden");
      $("#videoReader, #videoSource").addClass("hidden");
    }
  }

  /* redeem from button code */

  $("#redeemFromBtn").click(function(){
    var redeem = redeemingFrom($("#redeemFrom").val());

    $("#redeemFromStatus, #redeemFromAddress").addClass('hidden');

    if(redeem.from=='multisigAddress'){
      $("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> You should use the redeem script, not the multisig address!');
      return false;
    }

    if(redeem.from=='other'){
      $("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> The address or multisig redeem script you have entered is invalid');
      return false;
    }

    if($("#clearInputsOnLoad").is(":checked")){
      $("#inputs .txidRemove, #inputs .txidClear").click();
    }

    $("#redeemFromBtn").html("Please wait, loading...").attr('disabled',true);

    var host = $(this).attr('rel');


    listUnspentCryptoidinfo_RVN(redeem);

    if($("#redeemFromStatus").hasClass("hidden")) {
      // An ethical dilemma: Should we automatically set nLockTime?
      if(redeem.from == 'redeemScript' && redeem.decodedRs.type == "hodl__") {
        $("#nLockTime").val(redeem.decodedRs.checklocktimeverify);
      } else {
        $("#nLockTime").val(0);
      }
    }
  });

  /* function to determine what we are redeeming from */
  function redeemingFrom(string){
    var r = {};
    var decode = coinjs.addressDecode(string);
    if(decode.version == coinjs.pub){ // regular address
      r.addr = string;
      r.from = 'address';
      r.isMultisig = false;
    } else if (decode.version == coinjs.priv){ // wif key
      var a = coinjs.wif2address(string);
      r.addr = a['address'];
      r.from = 'wif';
      r.isMultisig = false;
    } else if (decode.version == coinjs.multisig){ // mulisig address
      r.addr = '';
      r.from = 'multisigAddress';
      r.isMultisig = false;
    } else {
      var script = coinjs.script();
      var decodeRs = script.decodeRedeemScript(string);
      if(decodeRs){ // redeem script
        r.addr = decodeRs['address'];
        r.from = 'redeemScript';
        r.decodedRs = decodeRs;
        r.isMultisig = true; // not quite, may be hodl
      } else { // something else
        r.addr = '';
        r.from = 'other';
        r.isMultisig = false;
      }
    }
    return r;
  }

  /* mediator payment code for when you used a public key */
  function mediatorPayment(redeem){

    if(redeem.from=="redeemScript"){

      $('#recipients .row[rel="'+redeem.addr+'"]').parent().remove();

      $.each(redeem.decodedRs.pubkeys, function(i, o){
        $.each($("#mediatorList option"), function(mi, mo){

          var ms = ($(mo).val()).split(";");

          var pubkey = ms[0]; // mediators pubkey
          var fee = ms[2]*1; // fee in a percentage
          var payto = coinjs.pubkey2address(pubkey); // pay to mediators address

          if(o==pubkey){ // matched a mediators pubkey?

            var clone = '<span><div class="row recipients mediator mediator_'+pubkey+'" rel="'+redeem.addr+'">'+$("#recipients .addressAddTo").parent().parent().html()+'</div><br></span>';
            $("#recipients").prepend(clone);

            $("#recipients .mediator_"+pubkey+" .glyphicon-plus:first").removeClass('glyphicon-plus');
            $("#recipients .mediator_"+pubkey+" .address:first").val(payto).attr('disabled', true).attr('readonly',true).attr('title','Medation fee for '+$(mo).html());

            var amount = ((fee*$("#totalInput").html())/100).toFixed(8);
            $("#recipients .mediator_"+pubkey+" .amount:first").attr('disabled',(((amount*1)==0)?false:true)).val(amount).attr('title','Medation fee for '+$(mo).html());
          }
        });
      });

      validateOutputAmount();
    }
  }

  /* global function to add outputs to page */
  function addOutput(tx, n, script, amount) {
    console.log("Adding output: "+tx+" "+n+" "+script+" "+amount);
    if(tx){
      if($("#inputs .txId:last").val()!=""){
        $("#inputs .txidAdd").click();
      }

      $("#inputs .row:last input").attr('disabled',true);

      // var txid = ((tx).match(/.{1,2}/g).reverse()).join("")+'';

      $("#inputs .txId:last").val(tx);
      $("#inputs .txIdN:last").val(n);
      $("#inputs .txIdAmount:last").val(amount);

      if(script.match(/^00/) && script.length==44){
        s = coinjs.script();
        s.writeBytes(Crypto.util.hexToBytes(script));
        s.writeOp(0);
        s.writeBytes(coinjs.numToBytes((amount*100000000).toFixed(0), 8));
        script = Crypto.util.bytesToHex(s.buffer);
      }

      $("#inputs .txIdScript:last").val(script);
    }
  }

  /* default function to retreive unspent outputs*/  
  function listUnspentDefault(redeem){
    var tx = coinjs.transaction();
    tx.listUnspent(redeem.addr, function(data){
      if(redeem.addr) {
        $("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="'+explorer_addr+redeem.addr+'" target="_blank">'+redeem.addr+'</a>');

        $.each($(data).find("unspent").children(), function(i,o){
          var tx = $(o).find("tx_hash").text();
          var n = $(o).find("tx_output_n").text();
          var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : $(o).find("script").text();
          var amount = (($(o).find("value").text()*1)/100000000).toFixed(8);

          addOutput(tx, n, script, amount);
        });
      }

      $("#redeemFromBtn").html("Load").attr('disabled',false);
      totalInputAmount();

      mediatorPayment(redeem);
    });
  }


  /* retrieve unspent data from chain.so for U */
  function listUnspentCryptoidinfo_RVN(redeem) {

    $.ajax ({
      type: "GET",
      url: "/utxo.php?addy="+redeem.addr+"",
      dataType: "json",
      error: function() {
        $("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unable to retrieve unspent outputs!');
      },

      // TODO: Fix this...

      success: function(data) {
        if ($.isArray(data)) {
          $.each(data, function( index, value ) {
            console.log("Handling tx "+index);
            var o = data[index];
            console.log("Handling index "+index);
            var tx = o.txid;
            // var tx = ((""+o.txid).match(/.{1,2}/g).reverse()).join("")+'';
            if(tx.match(/^[a-f0-9]+$/)){
              var n = o.vout;
              var script = (redeem.isMultisig==true) ? $("#redeemFrom").val() : o.scriptPubKey;
              var amount = (o.amount).toFixed(8);
              addOutput(tx, n, script, amount);
            }
          });
          $("#redeemFromAddress").removeClass('hidden').html('<span class="glyphicon glyphicon-info-sign"></span> Retrieved unspent inputs from address <a href="'+explorer_addr+redeem.addr+'" target="_blank">'+redeem.addr+'</a>');
        } else {
          $("#redeemFromStatus").removeClass('hidden').html('<span class="glyphicon glyphicon-exclamation-sign"></span> Unexpected error, unable to retrieve unspent outputs.');
        }
      },
      complete: function(data, status) {
        $("#redeemFromBtn").html("Load").attr('disabled',false);
        totalInputAmount();
      }
    });

  }


  /* math to calculate the inputs and outputs */
  function totalInputAmount(){
    $("#totalInput").html('0.00');
    $.each($("#inputs .txIdAmount"), function(i,o){
      if(isNaN($(o).val())){
        $(o).parent().addClass('has-error');
      } else {
        $(o).parent().removeClass('has-error');
        var f = 0;
        if(!isNaN($(o).val())){
          f += $(o).val()*1;
        }
        $("#totalInput").html((($("#totalInput").html()*1) + (f*1)).toFixed(8));
      }
    });
    totalFee();
  }

  function validateOutputAmount(){
    $("#recipients .amount").unbind('');
    $("#recipients .amount").keyup(function(){
      if(isNaN($(this).val())){
        $(this).parent().addClass('has-error');
      } else {
        $(this).parent().removeClass('has-error');
        var f = 0;
        $.each($("#recipients .amount"),function(i,o){
          if(!isNaN($(o).val())){
            f += $(o).val()*1;
          }
        });
        $("#totalOutput").html((f).toFixed(8));
      }
      totalFee();
    }).keyup();
  }

  function totalFee(){
    var fee = (($("#totalInput").html()*1) - ($("#totalOutput").html()*1)).toFixed(8);
    $("#transactionFee").val((fee>0)?fee:'0.00');
  }

  $(".optionsCollapse").click(function(){
    if($(".optionsAdvanced",$(this).parent()).hasClass('hidden')){
      $(".glyphcollapse",$(this).parent()).removeClass('glyphicon-collapse-down').addClass('glyphicon-collapse-up');
      $(".optionsAdvanced",$(this).parent()).removeClass("hidden");
    } else {
      $(".glyphcollapse",$(this).parent()).removeClass('glyphicon-collapse-up').addClass('glyphicon-collapse-down');
      $(".optionsAdvanced",$(this).parent()).addClass("hidden");
    }
  });

  /* broadcast a transaction */

  $("#rawSubmitBtn").click(function(){
    rawSubmitDefault(this);
  });

  // broadcast transaction vai coinbin (default)
  function rawSubmitDefault(btn){
    var thisbtn = btn;
    $(thisbtn).val('Please wait, loading...').attr('disabled',true);
    $.ajax ({
      type: "POST",
            url: '/broadcast.php?foo=go',
      data: {'rawtx':$("#rawTransaction").val()},
      dataType: "text",
      error: function(resp) {
        $("#rawTransactionStatus").addClass('alert-danger').removeClass('alert-success').removeClass("hidden").html(" There was an error submitting your request, please try again").prepend('<span class="glyphicon glyphicon-exclamation-sign"></span>');
      },
      complete: function(resp, status) {
                if (resp.responseText) {
console.log(resp.responseText);
                   $("#rawTransactionStatus").addClass('alert-success').removeClass('alert-danger');
                   $("#rawTransactionStatus").html('Success! '+resp.responseText);
                }
      }
    });
    $("#rawTransactionStatus").fadeOut().fadeIn();
    $(thisbtn).val('Submit').attr('disabled',false);
  }

  /* verify script code */
  $("#verifyBtn").click(function(){
    $(".verifyData").addClass("hidden");
    $("#verifyStatus").hide();
    if(!decodeRedeemScript()){
      if(!decodeTransactionScript()){
        if(!decodePrivKey()){
          if(!decodePubKey()){
            if(!decodeHDaddress()){
              $("#verifyStatus").removeClass('hidden').fadeOut().fadeIn();
            }
          }
        }
      }
    }

  });

  function decodeRedeemScript(){
    var script = coinjs.script();
    var decode = script.decodeRedeemScript($("#verifyScript").val());
    if(decode){
      $("#verifyRsDataMultisig").addClass('hidden');
      $("#verifyRsDataHodl").addClass('hidden');
      $("#verifyRsData").addClass("hidden");


      if(decode.type == "multisig__") {
        $("#verifyRsDataMultisig .multisigAddress").val(decode['address']);
        $("#verifyRsDataMultisig .signaturesRequired").html(decode['signaturesRequired']);
        $("#verifyRsDataMultisig table tbody").html("");
        for(var i=0;i<decode.pubkeys.length;i++){
          var pubkey = decode.pubkeys[i];
          var address = coinjs.pubkey2address(pubkey);
          $('<tr><td width="30%"><input type="text" class="form-control" value="'+address+'" readonly></td><td><input type="text" class="form-control" value="'+pubkey+'" readonly></td></tr>').appendTo("#verifyRsDataMultisig table tbody");
        }
        $("#verifyRsData").removeClass("hidden");
        $("#verifyRsDataMultisig").removeClass('hidden');
        $(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
        return true;
      } else if(decode.type == "hodl__") {
        var d = $("#verifyRsDataHodl .date").data("DateTimePicker");
        $("#verifyRsDataHodl .address").val(decode['address']);
        $("#verifyRsDataHodl .pubkey").val(coinjs.pubkey2address(decode['pubkey']));
        $("#verifyRsDataHodl .date").val(decode['checklocktimeverify'] >= 500000000? moment.unix(decode['checklocktimeverify']).format("MM/DD/YYYY HH:mm") : decode['checklocktimeverify']);
        $("#verifyRsData").removeClass("hidden");
        $("#verifyRsDataHodl").removeClass('hidden');
        $(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
        return true;
      }
    }
    return false;
  }

  function decodeTransactionScript(){
    var tx = coinjs.transaction();
    try {
      var decode = tx.deserialize($("#verifyScript").val());
      $("#verifyTransactionData .transactionVersion").html(decode['version']);
      $("#verifyTransactionData .transactionSize").html(decode.size()+' <i>bytes</i>');
      $("#verifyTransactionData .transactionLockTime").html(decode['lock_time']);
      $("#verifyTransactionData").removeClass("hidden");
      $("#verifyTransactionData tbody").html("");

      var h = '';
      $.each(decode.ins, function(i,o){
        var s = decode.extractScriptKey(i);
        h += '<tr>';
        h += '<td><input class="form-control" type="text" value="'+o.outpoint.hash+'" readonly></td>';
        h += '<td class="col-xs-1">'+o.outpoint.index+'</td>';
        h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
        h += '<td class="col-xs-1"> <span class="glyphicon glyphicon-'+((s.signed=='true' || (decode.witness[i] && decode.witness[i].length==2))?'ok':'remove')+'-circle"></span>';
        if(s['type']=='multisig' && s['signatures']>=1){
          h += ' '+s['signatures'];
        }
        h += '</td>';
        h += '<td class="col-xs-1">';
        if(s['type']=='multisig'){
          var script = coinjs.script();
          var rs = script.decodeRedeemScript(s.script);
          h += rs['signaturesRequired']+' of '+rs['pubkeys'].length;
        } else {
          h += '<span class="glyphicon glyphicon-remove-circle"></span>';
        }
        h += '</td>';
        h += '</tr>';

      });

      $(h).appendTo("#verifyTransactionData .ins tbody");

      h = '';
      $.each(decode.outs, function(i,o){

        if(o.script.chunks.length==2 && o.script.chunks[0]==106){ // OP_RETURN

          var data = Crypto.util.bytesToHex(o.script.chunks[1]);
          var dataascii = hex2ascii(data);

          if(dataascii.match(/^[\s\d\w]+$/ig)){
            data = dataascii;
          }

          h += '<tr>';
          h += '<td><input type="text" class="form-control" value="(OP_RETURN) '+data+'" readonly></td>';
          h += '<td class="col-xs-1">'+(o.value/100000000).toFixed(8)+'</td>';
          h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
          h += '</tr>';
        } else {

          var addr = '';
          if(o.script.chunks.length==5){
            addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[2]));
          } else {
            var pub = coinjs.pub;
            coinjs.pub = coinjs.multisig;
            addr = coinjs.scripthash2address(Crypto.util.bytesToHex(o.script.chunks[1]));
            coinjs.pub = pub;
          }

          h += '<tr>';
          h += '<td><input class="form-control" type="text" value="'+addr+'" readonly></td>';
          h += '<td class="col-xs-1">'+(o.value/100000000).toFixed(8)+'</td>';
          h += '<td class="col-xs-2"><input class="form-control" type="text" value="'+Crypto.util.bytesToHex(o.script.buffer)+'" readonly></td>';
          h += '</tr>';
        }
      });
      $(h).appendTo("#verifyTransactionData .outs tbody");

      $(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
      return true;
    } catch(e) {
      return false;
    }
  }

  function hex2ascii(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
  }

  function decodePrivKey(){
    var wif = $("#verifyScript").val();
    if(wif.length==51 || wif.length==52){
      try {
        var w2address = coinjs.wif2address(wif);
        var w2pubkey = coinjs.wif2pubkey(wif);
        var w2privkey = coinjs.wif2privkey(wif);

        $("#verifyPrivKey .address").val(w2address['address']);
        $("#verifyPrivKey .pubkey").val(w2pubkey['pubkey']);
        $("#verifyPrivKey .privkey").val(w2privkey['privkey']);
        $("#verifyPrivKey .iscompressed").html(w2address['compressed']?'true':'false');

        $("#verifyPrivKey").removeClass("hidden");
        return true;
      } catch (e) {
        return false;
      }
    } else {
      return false;
    }
  }

  function decodePubKey(){
    var pubkey = $("#verifyScript").val();
    if(pubkey.length==66 || pubkey.length==130){
      try {
        $("#verifyPubKey .verifyDataSw").addClass('hidden');
        $("#verifyPubKey .address").val(coinjs.pubkey2address(pubkey));
        $("#verifyPubKey").removeClass("hidden");
        $(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
        return true;
      } catch (e) {
        return false;
      }
    } else {
      return false;
    }
  }

  function decodeHDaddress(){
    coinjs.compressed = true;
    var s = $("#verifyScript").val();
    try {
      var hex = Crypto.util.bytesToHex((coinjs.base58decode(s)).slice(0,4));
      var hex_cmp_prv = Crypto.util.bytesToHex((coinjs.numToBytes(coinjs.hdkey.prv,4)).reverse());
      var hex_cmp_pub = Crypto.util.bytesToHex((coinjs.numToBytes(coinjs.hdkey.pub,4)).reverse());
      if(hex == hex_cmp_prv || hex == hex_cmp_pub){
        var hd = coinjs.hd(s);
        $("#verifyHDaddress .hdKey").html(s);
        $("#verifyHDaddress .chain_code").val(Crypto.util.bytesToHex(hd.chain_code));
        $("#verifyHDaddress .depth").val(hd.depth);
        $("#verifyHDaddress .version").val('0x'+(hd.version).toString(16));
        $("#verifyHDaddress .child_index").val(hd.child_index);
        $("#verifyHDaddress .hdwifkey").val((hd.keys.wif)?hd.keys.wif:'');
        $("#verifyHDaddress .key_type").html((((hd.depth==0 && hd.child_index==0)?'Master':'Derived')+' '+hd.type).toLowerCase());
        $("#verifyHDaddress .parent_fingerprint").val(Crypto.util.bytesToHex(hd.parent_fingerprint));
        $("#verifyHDaddress .derived_data table tbody").html("");
        deriveHDaddress();
        $(".verifyLink").attr('href','?verify='+$("#verifyScript").val());
        $("#verifyHDaddress").removeClass("hidden");
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  function deriveHDaddress() {
    var hd = coinjs.hd($("#verifyHDaddress .hdKey").html());
    var index_start = $("#verifyHDaddress .derivation_index_start").val()*1;
    var index_end = $("#verifyHDaddress .derivation_index_end").val()*1;
    var html = '';
    $("#verifyHDaddress .derived_data table tbody").html("");
    for(var i=index_start;i<=index_end;i++){
      var derived = hd.derive(i);
      html += '<tr>';
      html += '<td>'+i+'</td>';
      html += '<td><input type="text" class="form-control" value="'+derived.keys.address+'" readonly></td>';
      html += '<td><input type="text" class="form-control" value="'+((derived.keys.wif)?derived.keys.wif:'')+'" readonly></td>';
      html += '<td><input type="text" class="form-control" value="'+derived.keys_extended.pubkey+'" readonly></td>';
      html += '<td><input type="text" class="form-control" value="'+((derived.keys_extended.privkey)?derived.keys_extended.privkey:'')+'" readonly></td>';
      html += '</tr>';
    }
    $(html).appendTo("#verifyHDaddress .derived_data table tbody");
  }


  /* sign code */

  $("#signBtn").click(function(){
    var wifkey = $("#signPrivateKey");
    var script = $("#signTransaction");

    if(coinjs.addressDecode(wifkey.val())){
      $(wifkey).parent().removeClass('has-error');
    } else {
      $(wifkey).parent().addClass('has-error');
    }

    if((script.val()).match(/^[a-f0-9]+$/ig)){
      $(script).parent().removeClass('has-error');
    } else {
      $(script).parent().addClass('has-error');
    }

    if($("#sign .has-error").length==0){
      $("#signedDataError").addClass('hidden');
      try {
        var tx = coinjs.transaction();
        var t = tx.deserialize(script.val());

        var signed = t.sign(wifkey.val(), $("#sighashType option:selected").val());
        $("#signedData textarea").val(signed);
        $("#signedData .txSize").html(t.size());
        $("#signedData").removeClass('hidden').fadeIn();
      } catch(e) {
        // console.log(e);
      }
    } else {
      $("#signedDataError").removeClass('hidden');
      $("#signedData").addClass('hidden');
    }
  });

  $("#sighashType").change(function(){
    $("#sighashTypeInfo").html($("option:selected",this).attr('rel')).fadeOut().fadeIn();
  });

  $("#signAdvancedCollapse").click(function(){
    if($("#signAdvanced").hasClass('hidden')){
      $("span",this).removeClass('glyphicon-collapse-down').addClass('glyphicon-collapse-up');
      $("#signAdvanced").removeClass("hidden");
    } else {
      $("span",this).removeClass('glyphicon-collapse-up').addClass('glyphicon-collapse-down');
      $("#signAdvanced").addClass("hidden");
    }
  });

  /* page load code */

  function _get(value) {
    var dataArray = (document.location.search).match(/(([a-z0-9\_\[\]]+\=[a-z0-9\_\.\%\@]+))/gi);
    var r = [];
    if(dataArray) {
      for(var x in dataArray) {
        if((dataArray[x]) && typeof(dataArray[x])=='string') {
          if((dataArray[x].split('=')[0].toLowerCase()).replace(/\[\]$/ig,'') == value.toLowerCase()) {
            r.push(unescape(dataArray[x].split('=')[1]));
          }
        }
      }
    }
    return r;
  }

  var _getBroadcast = _get("broadcast");
  if(_getBroadcast[0]){
    $("#rawTransaction").val(_getBroadcast[0]);
    $("#rawSubmitBtn").click();
    window.location.hash = "#broadcast";
  }

  var _getVerify = _get("verify");
  if(_getVerify[0]){
    $("#verifyScript").val(_getVerify[0]);
    $("#verifyBtn").click();
    window.location.hash = "#verify";
  }

  $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    if(e.target.hash == "#fees"){
      feeStats();
    }
  })

  $(".qrcodeBtn").click(function(){
    $("#qrcode").html("");
    var thisbtn = $(this).parent().parent();
    var qrstr = false;
    var ta = $("textarea",thisbtn);

    if(ta.length>0){
      var w = (screen.availWidth > screen.availHeight ? screen.availWidth : screen.availHeight)/3;
      var qrcode = new QRCode("qrcode", {width:w, height:w});
      qrstr = $(ta).val();
      if(qrstr.length > 1024){
        $("#qrcode").html("<p>Sorry the data is too long for the QR generator.</p>");
      }
    } else {
      var qrcode = new QRCode("qrcode");
      qrstr = "rvn:"+$('.address',thisbtn).val();
    }

    if(qrstr){
      qrcode.makeCode(qrstr);
    }
  });

  $('input[title!=""], abbr[title!=""]').tooltip({'placement':'bottom'});

  if (location.hash !== ''){
    $('a[href="' + location.hash + '"]').tab('show');
  }

  $(".showKey").click(function(){
    $("input[type='password']",$(this).parent().parent()).attr('type','text');
  });

  $("#homeBtn").click(function(e){
    e.preventDefault();
    history.pushState(null, null, '#home');
    $("#header .active, #content .tab-content").removeClass("active");
    $("#home").addClass("active");
  });

  $('a[data-toggle="tab"]').on('click', function(e) {
    e.preventDefault();
    if(e.target){
      history.pushState(null, null, '#'+$(e.target).attr('href').substr(1));
    }
  });

  window.addEventListener("popstate", function(e) {
    var activeTab = $('[href=' + location.hash + ']');
    if (activeTab.length) {
      activeTab.tab('show');
    } else {
      $('.nav-tabs a:first').tab('show');
    }
  });

  // for(i=1;i<3;i++){ $(".pubkeyAdd").click(); }

  validateOutputAmount();

  /* settings page code */

  $("#coinjs_pub").val('0x'+(coinjs.pub).toString(16));
  $("#coinjs_priv").val('0x'+(coinjs.priv).toString(16));
  $("#coinjs_multisig").val('0x'+(coinjs.multisig).toString(16));

  $("#coinjs_hdpub").val('0x'+(coinjs.hdkey.pub).toString(16));
  $("#coinjs_hdprv").val('0x'+(coinjs.hdkey.prv).toString(16));  

  $("#coinjs_coin").change(function(){

    var o = ($("option:selected",this).attr("rel")).split(";");

    // deal with broadcasting settings
    if(o[5]=="false"){
      $("#coinjs_broadcast, #rawTransaction, #rawSubmitBtn, #openBtn").attr('disabled',true);
      $("#coinjs_broadcast").val("coinb.in");      
    } else {
      $("#coinjs_broadcast").val(o[5]);
      $("#coinjs_broadcast, #rawTransaction, #rawSubmitBtn, #openBtn").attr('disabled',false);
    }

    // deal with unspent output settings
    if(o[6]=="false"){
      $("#coinjs_utxo, #redeemFrom, #redeemFromBtn, #openBtn, .qrcodeScanner").attr('disabled',true);      
      $("#coinjs_utxo").val("coinb.in");
    } else {
      $("#coinjs_utxo").val(o[6]);
      $("#coinjs_utxo, #redeemFrom, #redeemFromBtn, #openBtn, .qrcodeScanner").attr('disabled',false);
    }

    // deal with the reset
    $("#coinjs_pub").val(o[0]);
    $("#coinjs_priv").val(o[1]);
    $("#coinjs_multisig").val(o[2]);
    $("#coinjs_hdpub").val(o[3]);
    $("#coinjs_hdprv").val(o[4]);

    // hide/show custom screen
    if($("option:selected",this).val()=="custom"){
      $("#settingsCustom").removeClass("hidden");
    } else {
      $("#settingsCustom").addClass("hidden");
    }
  });

  function configureGetUnspentTx(){
    $("#redeemFromBtn").attr('rel',$("#coinjs_utxo option:selected").val());
  }


  /* fees page code */

  $("#fees .slider").on('input', function(){
    $('.'+$(this).attr('rel')+' .inputno, .'+$(this).attr('rel')+' .outputno',$("#fees")).html($(this).val());
    $('.'+$(this).attr('rel')+' .estimate',$("#fees")).removeClass('hidden');
  });

  $("#fees .txo_p2pkh").on('input', function(){
    var outputno = $('.'+$(this).attr('rel')+' .outputno',$("#fees .txoutputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txoutputs")).html((outputno*$("#est_txo_p2pkh").val())+(outputno*9));
    mathFees();
  });

  $("#fees .txo_p2sh").on('input', function(){
    var outputno = $('.'+$(this).attr('rel')+' .outputno',$("#fees .txoutputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txoutputs")).html((outputno*$("#est_txo_p2sh").val())+(outputno*9));
    mathFees();
  });

  $("#fees .txi_regular").on('input', function(){
    var inputno = $('.'+$(this).attr('rel')+' .inputno',$("#fees .txinputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txinputs")).html((inputno*$("#est_txi_regular").val())+(inputno*41));
    mathFees();
  });

  $("#fees .txi_multisig").on('input', function(){
    var inputno = $('.'+$(this).attr('rel')+' .inputno',$("#fees .txinputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txinputs")).html((inputno*$("#est_txi_multisig").val())+(inputno*41));
    mathFees();
  });

  $("#fees .txi_hodl").on('input', function(){
    var inputno = $('.'+$(this).attr('rel')+' .inputno',$("#fees .txinputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txinputs")).html((inputno*$("#est_txi_hodl").val())+(inputno*41));
    mathFees();
  });

  $("#fees .txi_unknown").on('input', function(){
    var inputno = $('.'+$(this).attr('rel')+' .inputno',$("#fees .txinputs")).html();
    $('.'+$(this).attr('rel')+' .bytes',$("#fees .txinputs")).html((inputno*$("#est_txi_unknown").val())+(inputno*41));
    mathFees();
  });

  $("#fees .sliderbtn.down").click(function(){
    var val = $(".slider",$(this).parent().parent()).val()*1;
    if(val>($(".slider",$(this).parent().parent()).attr('min')*1)){
      $(".slider",$(this).parent().parent()).val(val-1);
      $(".slider",$(this).parent().parent()).trigger('input');
    }
  });

  $("#fees .sliderbtn.up").click(function(){
    var val = $(".slider",$(this).parent().parent()).val()*1;
    if(val<($(".slider",$(this).parent().parent()).attr('max')*1)){
      $(".slider",$(this).parent().parent()).val(val+1);
      $(".slider",$(this).parent().parent()).trigger('input');
    }
  });

  $("#advancedFeesCollapse").click(function(){
    if($("#advancedFees").hasClass('hidden')){
      $("span",this).removeClass('glyphicon-collapse-down').addClass('glyphicon-collapse-up');
      $("#advancedFees").removeClass("hidden");
    } else {
      $("span",this).removeClass('glyphicon-collapse-up').addClass('glyphicon-collapse-down');
      $("#advancedFees").addClass("hidden");
    }
  });

  $("#analyseBtn").click(function(){
    if(!$("#fees .txhex").val().match(/^[a-f0-9]+$/ig)){
      alert('You must provide a hex encoded transaction');
      return;
    }

    var tx = coinjs.transaction();
    var deserialized = tx.deserialize($("#fees .txhex").val());

    $("#fees .txoutputs .outputno, #fees .txinputs .inputno").html("0");
    $("#fees .txoutputs .bytes, #fees .txinputs .bytes").html("0");
    $("#fees .slider").val(0);

    for(var i = 0; i < deserialized.ins.length; i++){
      var script = deserialized.extractScriptKey(i);
      var size = 41;
      if(script.type == 'multisig'){
        var s = coinjs.script();
        var rs = s.decodeRedeemScript(script.script);
        size += 4 + ((script.script.length / 2) + (73 * rs.signaturesRequired));
        $("#fees .multisig .inputno").html(($("#fees .multisig .inputno").html()*1)+1);
        $("#fees .txi_multisig").val(($("#fees .txi_multisig").val()*1)+1);
        $("#fees .multisig .bytes").html(size);

      } else if(script.type == 'hodl'){
        size += 78;
        $("#fees .hodl .inputno").html(($("#fees .hodl .inputno").html()*1)+1);
        $("#fees .hodl .bytes").html(size);
        $("#fees .txi_hodl").val(($("#fees .txi_hodl").val()*1)+1);

      } else if(script.type == 'empty' || script.type == 'scriptpubkey'){
        if(script.signatures == 1){
          size += script.script.length / 2;
        } else {
          size += $("#est_txi_regular").val()*1;
        }

        $("#fees .regular .inputno").html(($("#fees .regular .inputno").html()*1)+1);
        $("#fees .txi_regular").val(($("#fees .txi_regular").val()*1)+1);
        $("#fees .regular .bytes").html(($("#fees .regular .bytes").html()*1)+size);

      } else if(script.type == 'unknown'){
        size += script.script.length / 2;
        $("#fees .unknown .inputno").html(($("#fees .unknown .inputno").html()*1)+1);
        $("#fees .txi_unknown").val(($("#fees .txi_unknown").val()*1)+1);
        $("#fees .unknown .bytes").html(($("#fees .unknown .bytes").html()*1)+size);
      }
    }

    for(var i = 0; i < deserialized.outs.length; i++){
      if(deserialized.outs[i].script.buffer[0]==118){
        $("#fees .txoutputs .p2pkh .outputno").html(($("#fees .txoutputs .p2pkh .outputno").html()*1)+1);
        $("#fees .txoutputs .p2pkh .bytes").html(($("#fees .txoutputs .p2pkh .bytes").html()*1)+34);
        $("#fees .txo_p2pkh").val(($("#fees .txo_p2pkh").val()*1)+1);
      } else if (deserialized.outs[i].script.buffer[0]==169){
        $("#fees .txoutputs .p2sh .outputno").html(($("#fees .txoutputs .p2sh .outputno").html()*1)+1);
        $("#fees .txoutputs .p2sh .bytes").html(($("#fees .txoutputs .p2sh .bytes").html()*1)+32);
        $("#fees .txo_p2sh").val(($("#fees .txo_p2sh").val()*1)+1);
      } 
    }

    //feeStats();
  });

  $("#feeStatsReload").click(function(){
    feeStats();
  });

  function mathFees(){

    var inputsTotal = 0;
    var inputsBytes = 0;
    $.each($(".inputno"), function(i,o){
      inputsTotal += ($(o).html()*1);
      inputsBytes += ($(".bytes",$(o).parent()).html()*1);
    });
    
    $("#fees .txinputs .txsize").html(inputsBytes.toFixed(0));
    $("#fees .txinputs .txtotal").html(inputsTotal.toFixed(0));

    var outputsTotal = 0;
    var outputsBytes = 0;
    $.each($(".outputno"), function(i,o){
      outputsTotal += ($(o).html()*1);
      outputsBytes += ($(".bytes",$(o).parent()).html()*1);
    });
    
    $("#fees .txoutputs .txsize").html(outputsBytes.toFixed(0));
    $("#fees .txoutputs .txtotal").html(outputsTotal.toFixed(0));

    var totalBytes = 10 + outputsBytes + inputsBytes;
    if((!isNaN($("#fees .feeSatByte:first").html())) && totalBytes > 10){
      var recommendedFee = ((totalBytes * $(".feeSatByte").html())/100000000).toFixed(8);
      $(".recommendedFee").html(recommendedFee);
      $(".feeTxSize").html(totalBytes);
    } else {
      $(".recommendedFee").html((0).toFixed(8));
      $(".feeTxSize").html(0);
    }
  };

  /* capture mouse movement to add entropy */
  var IE = document.all?true:false // Boolean, is browser IE?
  if (!IE) document.captureEvents(Event.MOUSEMOVE)
  document.onmousemove = getMouseXY;
  function getMouseXY(e) {
    var tempX = 0;
    var tempY = 0;
    if (IE) { // If browser is IE
      tempX = event.clientX + document.body.scrollLeft;
      tempY = event.clientY + document.body.scrollTop;
    } else {
      tempX = e.pageX;
      tempY = e.pageY;
    };

    if (tempX < 0){tempX = 0};
    if (tempY < 0){tempY = 0};
    var xEnt = Crypto.util.bytesToHex([tempX]).slice(-2);
    var yEnt = Crypto.util.bytesToHex([tempY]).slice(-2);
    var addEnt = xEnt.concat(yEnt);

    if ($("#entropybucket").html().indexOf(xEnt) == -1 && $("#entropybucket").html().indexOf(yEnt) == -1) {
      $("#entropybucket").html(addEnt + $("#entropybucket").html());
    };

    if ($("#entropybucket").html().length > 128) {
      $("#entropybucket").html($("#entropybucket").html().slice(0, 128))
    };

    return true;
  };

});
