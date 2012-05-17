if (!Date.now) {
    Date.now = function now() {
        return +(new Date);
    };
}

DAY_IN_MILLISECONDS = 86400000;

var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function stripTime(date){
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
}

function formatDate(date, formatString){
    // done in the style of c's strftime
    // TODO slowly adding in new parts to this
    // note that this also doesn't escape things properly. sorry
    var ret = formatString;
    if(formatString.indexOf('%d') != -1){
        var dateNum = date.getUTCDate().toString();
        if(dateNum.length < 2)
            dateNum = '0' + dateNum;
        ret = ret.replace('%d', dateNum);
    }
    if(formatString.indexOf('%b') != -1){
        var month = monthNames[date.getUTCMonth()].substring(0, 3);
        ret = ret.replace('%b', month);
    }
    if(formatString.indexOf('%Y') != -1){
        ret = ret.replace('%Y', date.getUTCFullYear());
    }

    return ret;
}

function getLeft(elem){
    var leftString = elem.style.left;
    return parseInt(leftString.substring(0, leftString.length - 2));
}

function getEndDate(dateArray){
    return dateArray[dateArray.length - 1];
}

function isFifthDay(date){
    var day = date.getUTCDate();
    return (day == 1 || day % 5 == 0) && day != 30;
}

function isHalfMonth(date){
    var day = date.getUTCDate();
    return day == 1 || day == 15;
}

function prevMonth(date){
    var newDate = new Date(date.getTime() - DAY_IN_MILLISECONDS);
    return new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth(), 1));
}

function nextMonth(date){
    var newDate = new Date(date.getTime() + DAY_IN_MILLISECONDS);
    return new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth() + 1, 1));
}

function prevQuarter(date){
    var newDate = new Date(date - DAY_IN_MILLISECONDS);
    var month = newDate.getMonth();
    return new Date(Date.UTC(newDate.getUTCFullYear(), month - month % 3, 1));
}

function nextQuarter(date){
    var newDate = new Date(date.getTime() + DAY_IN_MILLISECONDS);
    var month = newDate.getUTCMonth();
    return new Date(Date.UTC(newDate.getUTCFullYear(), month - month % 3 + 3, 1));
}

function backWeek(date){
    return new Date(date - DAY_IN_MILLISECONDS * 7);
}

function forwardWeek(date){
    return new Date(date.getTime() + DAY_IN_MILLISECONDS * 7);
}

function Chronoline(domElement, events, options) {

    var defaults = {
        defaultStartDate: null,  // the date furthest to the left on load. Defaults to today
        startDate: null,  // start of the timeline. Defaults to first event date
        endDate: null,  // end of the timeline. Defauls to the last event date

        visibleSpan: 2592000000,  // in milliseconds,

        topMargin: 40,  // overhead space on the canvas. useful for additional content
        eventHeight: 5,  // how tall event events are
        eventMargin: 4,  // how far apart the events are
        dateLabelHeight: 50, // how tall the bottom margin for the dates is
        hashLength: 4,  // length of the hash marks for the days
        minEventsHeight: 40,
        maxEventsHeight: 1000,

	hashColor: '#b8b8b8',

        eventAttrs: {  // attrs for the bars and circles of the events
            fill: '#0055e1',
            stroke: '#0055e1',
            "stroke-width": 2
        },

        // predefined fns include: null (for daily), isFifthDay, isHalfMonth
        hashInterval: null,  // fn: date -> boolean, if a hash should appear
        labelInterval: null,  // fn: date -> boolean, if a hash should appear
        labelFormat: '%d',  // based on strftime

        subLabel: 'month',  // TODO generalize this code
        subLabelMargin: 2,
        subLabelAttrs: {'font-weight': 'bold'},
        floatingSubLabels: true,  // whether sublabels should float into view

        subSubLabel: 'year',  // TODO generalize this code
        subSubLabelMargin: 2,
        subSubLabelAttrs: {'font-weight': 'bold'},
        floatingSubSubLabels: true,  // whether subSublabels should float into view

        fontAttrs: {
	    'font-size': 10,
	    fill: '#000000'
	},
        scrollable: true,
        // predefined fns include: prevMonth, nextMonth, prevQuarter, nextQuarter, backWeek, forwardWeek
        scrollLeft: backWeek,
        scrollRight: forwardWeek,
        animated: false,

        tooltips: false,
        markToday: 'line',
        todayAttrs: {'stroke': '#484848'},

        sections: null,
        floatingSectionLabels: true,
        sectionLabelAttrs: {},
        sectionLabelsOnHover: true
    }
    var t = this;

    // FILL DEFAULTS
    for(var attrname in defaults){ t[attrname] = defaults[attrname];}
    for(var attrname in options){ t[attrname] = options[attrname];}

    // options shouldn't be on if there aren't any sections
    t.floatingSectionLabels &= t.sections != null;
    t.sectionLabelsOnHover &= t.sections != null;

    // HTML elements to put everything in
    t.domElement = domElement;

    t.wrapper = document.createElement('div');
    t.wrapper.className = 'chronoline-wrapper';
    t.domElement.appendChild(t.wrapper);

    // SORT EVENTS
    t.sortEvents = function(a, b){
        a = a.dates;
        b = b.dates;

        var aEnd = a[a.length - 1].getTime();
        var bEnd = b[b.length - 1].getTime();
        if(aEnd != bEnd){
            return aEnd - bEnd;
        }
        return a[0].getTime() - b[0].getTime();
    };

    // need to convert dates to UTC
    for(var i = 0; i < events.length; i++){
        for(var j = 0; j < events[i].dates.length; j++){
            stripTime(events[i].dates[j]);
        }
    }
    t.events = events;
    t.events.sort(t.sortEvents);

    // same thing for sections
    if(t.sections != null){
        for(var i = 0; i < t.sections.length; i++){
            for(var j = 0; j < t.sections[i].dates.length; j++){
                stripTime(t.sections[i].dates[j]);
            }
        }
        t.sections.sort(t.sortEvents);
    }


    // CALCULATING MORE THINGS
    // generating relevant dates
    t.today = new Date(Date.now());
    stripTime(t.today);

    if(t.defaultStartDate == null){
        t.defaultStartDate = t.today;
    }

    if(t.startDate == null){
        if(t.events.length > 0){
            t.startDate = t.events[0].dates[0];
            for(var i = 1; i < t.events.length; i++)
                if(t.events[i].dates[0] < t.startDate)
                    t.startDate = t.events[i].dates[0];
        } else if(t.sections.length > 0) {
            t.startDate = t.sections[0].dates[0];
            for(var i = 0; i < t.sections.length; i++){
                if(t.sections[i].dates[0] < t.startDate)
                    t.startDate = t.sections[i].dates[0];
            }
        } else {
            return;
        }
    }
    stripTime(t.startDate);

    if(t.startDate > t.defaultStartDate)
        t.startDate = t.defaultStartDate;
    t.startDate = new Date(t.startDate.getTime() - 86400000);
    t.startTime = t.startDate.getTime();

    if(t.endDate == null){
        if(t.events.length > 0){
            t.endDate = getEndDate(t.events[0].dates);
            for(var i = 1; i < t.events.length; i++)
                if(getEndDate(t.events[i].dates) > t.endDate)
                    t.endDate = getEndDate(t.events[i].dates);
        } else if(t.sections.length > 0) {
            t.endDate = t.sections[0].dates[1];
            for(var i = 0; i < t.sections.length; i++){
                if(t.sections[i].dates[1] > t.endDate)
                    t.endDate = t.sections[i].dates[1];
            }
        } else {
            return;
        }
    }
    if(t.endDate < t.defaultStartDate)
        t.endDate = t.defaultStartDate;
    t.endDate = new Date(Math.max(t.endDate.getTime() + 86400000, t.startDate.getTime() + t.visibleSpan))
    stripTime(t.endDate);


    // this ratio converts a time into a px position
    t.visibleWidth = t.domElement.clientWidth;
    t.pxRatio = t.visibleWidth / t.visibleSpan;
    t.totalWidth = t.pxRatio * (t.endDate.getTime() - t.startDate.getTime());
    t.maxLeftPx = t.totalWidth - t.visibleWidth;

    // 2 handy utility functions
    t.pxToMs = function(px){
        return t.startTime + px / t.pxRatio;
    }
    t.msToPx = function(ms){
        return (ms - t.startTime) * t.pxRatio;
    }

    // SPLIT THE DATES INTO THE ROW THAT THEY BELONG TO
    // TODO
    // this is a greedy algo that definitely isn't optimal
    // it at least needs to find the latest row that still fits
    // this, however, may cause very strange behavior (everything being on the 2nd line),
    // so I'm going to prefer this in the short term

    // calculated here so it can be used in splitting dates
    t.circleRadius = t.eventHeight / 2;

    t.eventRows = [[]];
    t.rowLastPxs = [0];

    for(var i = 0; i < t.events.length; i++){
        var found = false;
        var startPx = t.msToPx(t.events[i].dates[0].getTime()) - t.circleRadius;
        for(var j = 0; j < t.eventRows.length; j++){
            if(t.rowLastPxs[j] < startPx){
                t.eventRows[j].push(t.events[i]);
                t.rowLastPxs[j] = t.msToPx(getEndDate(t.events[i].dates).getTime()) + t.circleRadius;
                found = true;
                break;
            }
        }
        if(!found){
            t.eventRows.push([t.events[i]]);
            t.rowLastPxs.push(t.msToPx(getEndDate(t.events[i].dates).getTime()) + t.circleRadius);
        }
    }

    // a few more calculations and creation
    t.eventsHeight = Math.max(Math.min(t.eventRows.length * (t.eventMargin + t.eventHeight), t.maxEventsHeight), t.minEventsHeight);
    t.totalHeight = t.dateLabelHeight + t.eventsHeight + t.topMargin;

    // creating canvas pieces
    t.myCanvas = document.createElement('div');
    t.myCanvas.className = 'chronoline-canvas';
    t.wrapper.appendChild(t.myCanvas);

    t.paper = Raphael(t.myCanvas, t.totalWidth, t.totalHeight);
    t.paperElem = t.myCanvas.childNodes[0];

    // DRAWING
    t.floatingSet = t.paper.set();
    t.sectionLabelSet = t.paper.set();
    // drawing sections
    if(t.sections != null){
        for(var i = 0; i < t.sections.length; i++){
            var section = t.sections[i];
            var startX = (section.dates[0].getTime() - t.startTime) * t.pxRatio;
            var width = (section.dates[1] - section.dates[0]) * t.pxRatio;
            var elem = t.paper.rect(startX, 0, width, t.totalHeight);
            elem.attr('stroke-width', 0);
            elem.attr('stroke', '#ffffff');
            if(typeof section.attrs != "undefined"){
                elem.attr(section.attrs);
            }
            var sectionLabel = t.paper.text(startX + 10, 10, section.title);
            sectionLabel.attr('text-anchor', 'start');
            sectionLabel.attr(t.sectionLabelAttrs);
            if(t.floatingSectionLabels){
                // bounds determine how far things can float
                sectionLabel.data('left-bound', startX + 10);
                sectionLabel.data('right-bound', startX + width - sectionLabel.attr('width'));
                t.floatingSet.push(sectionLabel);
                t.sectionLabelSet.push(sectionLabel);
            }

            elem.data('label', sectionLabel);

            if(t.sectionLabelsOnHover){
                elem.hover(function(){this.data('label').animate({opacity: 1}, 200);},
                           function(){this.data('label').animate({opacity: 0}, 200);});
		sectionLabel.hover(function(){this.animate({opacity: 1}, 200);},
                                   function(){this.animate({opacity: 0}, 200);});
                sectionLabel.attr('opacity', 0);
            }

        }
    }

    // put all of these in front of the sections
    t.sectionLabelSet.forEach(function(label){
        label.toFront();
    });

    // drawing events
    for(var row = 0; row < t.eventRows.length; row++){
        var upperY = t.totalHeight - t.dateLabelHeight - (row + 1) * (t.eventMargin + t.eventHeight);
        for(var col = 0; col < t.eventRows[row].length; col++){
            var event = t.eventRows[row][col];
            var startX = (event.dates[0].getTime() - t.startTime) * t.pxRatio;
            var elem = null;
            if(event.dates.length == 1){  // it's a single point
                elem = t.paper.circle(startX, upperY + t.circleRadius, t.circleRadius).attr(t.eventAttrs);
            } else {  // it's a range
                var width = (getEndDate(event.dates) - event.dates[0]) * t.pxRatio;
                // left rounded corner
                var leftCircle = t.paper.circle(startX, upperY + t.circleRadius, t.circleRadius).attr(t.eventAttrs);
                if(typeof event.attrs != "undefined"){
                    leftCircle.attr(event.attrs);
                }
                // right rounded corner
                var rightCircle = t.paper.circle(startX + width, upperY + t.circleRadius, t.circleRadius).attr(t.eventAttrs);
                if(typeof event.attrs != "undefined"){
                    rightCircle.attr(event.attrs);
                }
                elem = t.paper.rect(startX, upperY, width, t.eventHeight).attr(t.eventAttrs);
            }

           if(typeof event.attrs != "undefined"){
                elem.attr(event.attrs);
            }

            elem.attr('title', event.title);
            if(t.tooltips && !jQuery.browser.msie){
                var description = event.description;
                var title = event.title;
                if(typeof description == "undefined" || description == ''){
                    description = title;
                    title = '';
                }
                jQuery(elem.node).parent().qtip({
                    content: {
                        title: title,
                        text: description
                    },
                    position: {
			my: 'top left',
			target: 'mouse',
			viewport: jQuery(window), // Keep it on-screen at all times if possible
			adjust: {
			    x: 10,  y: 10
			}
		    },
		    hide: {
			fixed: true // Helps to prevent the tooltip from hiding ocassionally when tracking!
		    },
                    style: {
                        classes: 'ui-tooltip-shadow ui-tooltip-dark ui-tooltip-rounded'
                    }
                });
            }
            if(t.sections != null && t.sectionLabelsOnHover){
                // some magic here to tie the event back to the section label element
                var originalIndex = event.section;
                if(typeof originalIndex != "undefined"){
                    var newIndex = 0;
                    for(var i = 0; i < t.sections.length; i++){
                        if(t.sections[i].section == originalIndex){
                            elem.data('sectionLabel', t.sectionLabelSet[i]);
                            break;
                        }
                    }
                    elem.hover(function(){this.data('sectionLabel').animate({opacity: 1}, 200);},
                               function(){this.data('sectionLabel').animate({opacity: 0}, 200);});
                }
            }
        }
    }

    // calculated ahead of time
    var dateLineY = t.totalHeight - t.dateLabelHeight;
    var baseline = t.paper.path('M0,' + dateLineY + 'L' + t.totalWidth + ',' + dateLineY);
    baseline.attr('stroke', t.hashColor);

    t.bottomHashY = dateLineY + t.hashLength;
    t.labelY = t.bottomHashY + t.fontAttrs['font-size'];
    t.subLabelY = t.bottomHashY + t.fontAttrs['font-size'] * 2 + t.subLabelMargin;
    t.subSubLabelY = t.subLabelY + t.fontAttrs['font-size'] + t.subSubLabelMargin;

    // DATE LABELS
    // only a helper b/c it works within a specific range

    // subSublabels. These can float
    if(t.subSubLabel == 'year'){
        var endYear = t.endDate.getFullYear();
        for(var year = t.startDate.getFullYear(); year <= endYear; year++){
            var curDate = new Date(year, 0, 1);
            stripTime(curDate);
            var x = t.msToPx(curDate.getTime());
            var subSubLabel = t.paper.text(x, t.subSubLabelY, formatDate(curDate, '%Y').toUpperCase());
            subSubLabel.attr(t.fontAttrs);
            subSubLabel.attr(t.subSubLabelAttrs);
            if(t.floatingSubSubLabels){
                // bounds determine how far things can float
                subSubLabel.data('left-bound', x);
                var endOfYear = new Date(year, 11, 31);
                stripTime(endOfYear);
                subSubLabel.data('right-bound',
                                 Math.min((endOfYear.getTime() - t.startTime) * t.pxRatio - 5,
                                          t.totalWidth));
                t.floatingSet.push(subSubLabel);
            }
        }
    }


    t.drawLabelsHelper = function(startMs, endMs){
        for(var curMs = startMs; curMs < endMs; curMs += DAY_IN_MILLISECONDS){
            var curDate = new Date(curMs);
            var day = curDate.getUTCDate();
            var x = t.msToPx(curMs);

            // the little hashes
            if(t.hashInterval == null || t.hashInterval(curDate)){
                var hash = t.paper.path('M' + x + ',' + dateLineY + 'L' + x + ',' + t.bottomHashY);
	        hash.attr('stroke', t.hashColor);
            }

            // the labels directly below the hashes
            if(t.labelInterval == null || t.labelInterval(curDate)){
                var displayDate = String(day);
                if(displayDate.length == 1)
                    displayDate = '0' + displayDate;

                var label = t.paper.text(x, t.labelY, displayDate);
                label.attr(t.fontAttrs);
            }

            // special markers for today
            if(t.markToday && curMs == t.today.getTime()){
                if(t.markToday == 'labelBox'){
                    label.attr({'text': label.attr('text') + '\n' + formatDate(curDate, '%b').toUpperCase(),
                                'font-size': t.fontAttrs['font-size'] + 2,
                                'y': t.bottomHashY + t.fontAttrs['font-size'] + 5});
                    var bbox = label.getBBox();
                    var labelBox = t.paper.rect(bbox.x - 2, bbox.y - 2, bbox.width + 4, bbox.height + 4);
                    labelBox.attr('fill', '90-#f4f4f4-#e8e8e8');
                    labelBox.insertBefore(label);
                }else if(t.markToday == 'line'){
                    var line = t.paper.path('M' + x + ',0L' + x + ',' + dateLineY);
                    line.attr(t.todayAttrs);
                }
            }

            // sublabels. These can float
            if(day == 1 && t.subLabel == 'month'){
                var subLabel = t.paper.text(x, t.subLabelY, formatDate(curDate, '%b').toUpperCase());
                subLabel.attr(t.fontAttrs);
                subLabel.attr(t.subLabelAttrs);
                if(t.floatingSubLabels){
                    // bounds determine how far things can float
                    subLabel.data('left-bound', x);
                    var endOfMonth = new Date(Date.UTC(curDate.getUTCFullYear(), curDate.getUTCMonth() + 1, 0));
                    subLabel.data('right-bound',
                                  Math.min((endOfMonth.getTime() - t.startTime) * t.pxRatio - 5,
                                           t.totalWidth));
                    t.floatingSet.push(subLabel);
                }
            }
        }
    }


    t.drawnStartMs = null;
    t.drawnEndMs = null;
    // this actually draws labels. It calculates the set of labels to draw in-between
    // what it currently has and needs to add
    t.drawLabels = function(leftPxPos){
        var newStartPx = Math.max(0, leftPxPos - t.visibleWidth);
        var newEndPx = Math.min(t.totalWidth, leftPxPos + 2 * t.visibleWidth);

        var newStartDate = new Date(t.pxToMs(leftPxPos));
        newStartDate = new Date(Date.UTC(newStartDate.getUTCFullYear(), newStartDate.getUTCMonth(), 1));

        var newStartMs = newStartDate.getTime();
        var newEndDate = new Date(t.pxToMs(Math.min(t.totalWidth, leftPxPos + 2 * t.visibleWidth)));
        stripTime(newEndDate);
        var newEndMs = newEndDate.getTime();

        if(t.drawnStartMs == null){  // first time
            t.drawnStartMs = newStartMs;
            t.drawnEndMs = newEndMs;
            t.drawLabelsHelper(newStartMs, newEndMs);
        }else if(newStartMs > t.drawnEndMs){  // new labels are to the right
            t.drawLabelsHelper(t.drawnEndMs, newEndMs);
            t.drawnEndMs = newEndMs;
        }else if(newEndMs < t.drawnStartMs){  // to the left
            t.drawLabelsHelper(newStartMs, t.drawnStartMs);
            t.drawnStartMs = newStartMs;
        }else {  // overlap
            if(newStartMs < t.drawnStartMs){
                t.drawLabelsHelper(newStartMs, t.drawnStartMs);
                t.drawnStartMs = newStartMs;
            }
            if(newEndMs > t.drawnEndMs){
                t.drawLabelsHelper(t.drawnEndMs, newEndMs);
                t.drawnEndMs = newEndMs;
            }
        }
    }

    t.isMoving = false;
    t.goToPx = function(finalLeft) {
        /*
          finalLeft is negative

          I tried several implementations here, including:
          - moving the left of the canvas within a wrapper (current strategy)
          - animating setViewbox using getAnimationFrame
          - animating each individual element using getAnimation frame

          - animating floating content using getAnimation (current strategy)
          - animating floating content using raphael.animate
          This solution is by far the smoothest and doesn't have any asynchrony problems. There's some twitching going on with floating content, but it's not THAT bad
        */
        if(t.isMoving) return;

        finalLeft = Math.min(finalLeft, 0);
        finalLeft = Math.max(finalLeft, -t.maxLeftPx);
        t.drawLabels(-finalLeft);
        var left = getLeft(t.paperElem);

        // hide scroll buttons if you're at the end
        if(t.scrollable){
            if(finalLeft == 0){
                t.leftControl.style.display = 'none';
            } else {
                t.leftControl.style.display = '';
            }
            if(finalLeft == t.visibleWidth - t.totalWidth){
                t.rightControl.style.display = 'none';
            } else {
                t.rightControl.style.display = '';
            }
        }

        var movingLabels = [];
        var floatedLeft = -finalLeft + 5;
        t.floatingSet.forEach(function(label){
            // pin the to the left side
            if(label.data('left-bound') < floatedLeft && label.data('right-bound') > floatedLeft) {
                movingLabels.push([label, label.attr('x'),
                                   floatedLeft - label.attr('x') + 10]);
            } else if(label.attr('x') != label.data('left-bound')) { // push it to where it should be
                movingLabels.push([label, label.attr('x'),
                                   label.data('left-bound') - label.attr('x')]);
            }
        });

        if(t.animated){
            t.isMoving = true;

            requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function( callback, element){
                return window.setTimeout(function(){callback(+new Date());}, 1000 / 60);
            };

            var start = Date.now();

            var elem = t.paperElem;
            function step(timestamp) {
                var progress = (timestamp - start) / 200;
                var pos = (finalLeft - left) * progress + left;
                elem.style.left = pos + "px";

                // move the labels
                for(var i = 0; i < movingLabels.length; i++){
                    movingLabels[i][0].attr('x', movingLabels[i][2] * progress + movingLabels[i][1]);
                }

                if (progress < 1) {  // keep going
                    requestAnimationFrame(step);
                }else{  // put it in its final position
                    t.paperElem.style.left = finalLeft + "px";
                    for(var i = 0; i < movingLabels.length; i++){
                        movingLabels[i][0].attr('x', movingLabels[i][2] + movingLabels[i][1]);
                    }
                    t.isMoving = false;
                }
            }
            requestAnimationFrame(step);

        }else{  // no animation is just a shift
            t.paperElem.style.left = finalLeft + 'px';
            for(var i = 0; i < movingLabels.length; i++){
                movingLabels[i][0].attr('x', movingLabels[i][2] + movingLabels[i][1]);
            }
        }
    }

    t.goToDate = function(date, position){
        // position is negative for left, 0 for middle, 1 for right
        stripTime(date);
        if(position < 0){
            t.goToPx(-t.msToPx(date.getTime()));
        } else if(position > 0){
            t.goToPx(-t.msToPx(date.getTime()) + t.visibleWidth);
        } else {
            t.goToPx(-t.msToPx(date.getTime()) + t.visibleWidth / 2);
        }
    }

    // CREATING THE NAVIGATION
    // this is boring
    if(t.scrollable){
        t.leftControl = document.createElement('div');
        t.leftControl.className = 'chronoline-left';
        t.leftControl.style.marginTop = t.topMargin + 'px';
        t.leftControl.onclick = function(){
            t.goToDate(t.scrollLeft(new Date(t.pxToMs(-getLeft(t.paperElem)))), -1);
            return false;
        };

        var leftIcon = document.createElement('div');
        leftIcon.className = 'chronoline-left-icon';
        t.leftControl.appendChild(leftIcon);
        t.wrapper.appendChild(t.leftControl);
        var controlHeight = Math.max(t.eventsHeight,
                                     t.leftControl.clientHeight);
        t.leftControl.style.height =  controlHeight + 'px';
        leftIcon.style.marginTop = (controlHeight - 15) / 2 + 'px';

        t.rightControl = document.createElement('div');
        t.rightControl.className = 'chronoline-right';
        t.rightControl.style.marginTop = t.topMargin + 'px';
        t.rightControl.onclick = function(){
            t.goToDate(t.scrollRight(new Date(t.pxToMs(-getLeft(t.paperElem)))), -1);
            return false;
        };

        var rightIcon = document.createElement('div');
        rightIcon.className = 'chronoline-right-icon';
        t.rightControl.appendChild(rightIcon);
        t.wrapper.appendChild(t.rightControl);
        t.rightControl.style.height = t.leftControl.style.height;
        rightIcon.style.marginTop = leftIcon.style.marginTop;

    }

    t.goToToday = function(){
        t.goToDate(t.today, 0);
    };

    t.getLeftTime = function(){
        return Math.floor(t.startTime - getLeft(t.paperElem) / t.pxRatio);
    };

    t.getRightTime = function(){
        return Math.floor(t.startTime - (getLeft(t.paperElem) - t.visibleWidth) / t.pxRatio);
    };

    // set the default position
    t.paperElem.style.left = - (t.defaultStartDate - t.startDate) * t.pxRatio + 20 + 'px';
    t.goToPx(getLeft(t.paperElem));
    t.myCanvas.style.height = t.totalHeight + 'px';
}
