(function ($) {
	$.fn.jsCronUI = function (settings) {
		var value;

		if (typeof settings === 'string') {
			//call method
			var args = Array.prototype.slice.call(arguments, 1);

			this.each(function () {
				var instance = $.data(this, 'jsCronUI');
				if (!instance) {
					throw new CronError(11, settings, [settings]);
				}
				if (!$.isFunction(instance[settings]) || settings.charAt(0) === '_') {
					throw new CronError(10, settings, [settings]);
				}
				value = instance[settings].apply(instance, args);
			});
		} else {
			return this.each(function () {
				var $this = $(this);
				var cron = new jsCronUI(settings, $this);

				$(this).data('jsCronUI', cron);
			});
		}

		return typeof value !== 'undefined' ? value : this;
	};
}).call(this, jQuery);

(function ($) {
	/*
		10-19: Generic errors
		20-29: Time-related errors
		30-39: Daily-specific errors
		40-49: Weekly-specific errors
		50-59: Monthly-specific errors
		60-69: Yearly-specific errors
		70-79: Non-implementation errors
		80	 : Unknown errors
	*/
	var errorList = [
		{ id: 10, message: 'No such method %1' },
		{ id: 11, message: 'Cannot call method %1 on jsCronUI prior to initialization' },
		{ id: 12, message: 'Could not load schedule with expression: %1' },
		{ id: 13, message: 'A schedule type is required.' },
		{ id: 14, message: 'No template found or provided. Please provide a template or include the default template file.'},
		{ id: 20, message: 'A time is required.' },
		{ id: 30, message: 'A daily selection is required. %1' },
		{ id: 40, message: 'A day of week selection is required. %1' },
		{ id: 50, message: 'A date or day of week selection is required.' },
		{ id: 51, message: 'Must provide one or more days' },
		{ id: 52, message: 'Must select a day of the week' },
		{ id: 53, message: 'Must select an occurrence' },
		{ id: 54, message: 'Invalid days: %1' },		
		{ id: 60, message: 'Could not understand yearly schedule options. %1' },
		{ id: 61, message: 'A month and date or day of week selection is required.' },
		{ id: 62, message: 'Must select one or more months' },
		{ id: 63, message: 'Must provide one or more days' },
		{ id: 64, message: 'Must choose a day of the week' },
		{ id: 65, message: 'Must choose an occurrence' },
		{ id: 66, message: 'Invalid days: %1' },
		{ id: 70, message: 'Not implemented: %1.toEnglishString' },
		{ id: 73, message: 'Not implemented: Monthly.%1.toEnglishString' },
		{ id: 74, message: 'Not implemented: Yearly.%1.toEnglishString' },
		{ id: 80, message: 'Unknown error occurred inside jsCronUI library: %1' }
	];
	
	function CronError(number, additionalData, substitutions) {
		this.number = number;
		this.message = errorList.filter(function(error){
			return error.id === number;
		})[0].message;

		if (substitutions)
		{
			for (var i = substitutions.length - 1; i >= 0; i--) {
				this.message = this.message.replace(new RegExp('%' + (i + 1), 'g'), substitutions[i]);
			}
		}

		this.data = additionalData;
		this.stack = (new Error()).stack;
	}

	CronError.prototype = Object.create(Error.prototype);
	CronError.prototype.constructor = CronError;

	this.CronError = CronError;
}).call(this, jQuery);

(function ($) {
	function jsCronUI(settings, $element) {
		var self = this;
		self.$el = $($element);

		if (settings){
			self.$bindTo = settings.bindTo || null;
			self.initialValue = settings.initialValue;
		}

		var disableUiUpdates = false;
		var currentState = {
			time: '',
			pattern: '',
			selected: '',
			days: [],
			occurrence: '',
			dayOfWeek: '',
			months: []
		};

		this.reset = function () {
			currentState = {
				time: '',
				pattern: '',
				selected: '',
				days: [],
				occurrence: '',
				dayOfWeek: '',
				months: []
			};

			disableUiUpdates = true;
			resetDom();
			disableUiUpdates = false;
		};

		function resetDom() {
			self.$el.find('input:radio,input:checkbox').prop('checked', false).change();
			self.$el.find('input:text').val('').change();
			hideAll();
			self.$el.find('.c-schedule-options').hide();
			self.$el.find('[name="time"]').attr('data-time', '');
			self.$el.find('select[multiple]').multipleSelect('setSelects', []);

			updateDom();
		}

		function init() {

			if (settings && (!settings.container || !settings.container instanceof jQuery)) {
				
				if ($.fn.jsCronUI.template) {
					self.$el.append($.fn.jsCronUI.template());
				}
				else {
					throw new CronError(14);
				}
			}

			wireEvents();

			if (self.$bindTo && self.$bindTo instanceof jQuery && self.initialValue) {
				self.setCron(self.initialValue);
			}

			updateDom();

			self.$el.find('div input,select').on('change', function () {
				cleanInputs();
				updateFromDom();
			});
		};

		this.setCron = function (expression) {
			function pad(string, max) {
				string = string.toString();

				return string.length < max ? pad('0' + string, max) : string;
			}

			var inDays, days, i;

			if (!expression) {
				return;
			}

			//Model expression format: ss MM hh dd mm ww yyyy
			var values = expression.split(' ');

			if (values.length === 6) {
				values.push('*'); //explicitely declare every year
			}

			if (values.length !== 7) {
				throw new CronError(12, expression, [expression]);
			}

			//reset model to default values
			this.reset();

			currentState.time = pad(values[2], 2) + ':' + pad(values[1], 2);

			if (values[4] !== '*') {
				//Expression is yearly
				currentState.pattern = 'yearly';
				currentState.months = values[4].split(',');

				if (values[3] !== '?') {
					//Specific day of the month
					currentState.selected = 'specificDay';
					currentState.days = values[3].split(',');
				}
				else if (values[5].indexOf('#') > 0) {
					//Specific occurrence of the month
					currentState.selected = 'weekOccurrence';
					var occArr = values[5].split('#');

					currentState.dayOfWeek = occArr[0];
					currentState.occurrence = '#' + occArr[1];
				}
				else if (values[5].indexOf('L') > 0) {
					//Specific occurrence of the month
					currentState.selected = 'weekOccurrence';

					currentState.occurrence = 'L';
					currentState.dayOfWeek = values[5].split('L')[0];
				}
				else {
					throw new CronError(60, expression, [expression]);
				}
			}
			else if (values[3] === '*' || values[5] === '*') {
				//Expression is daily - every day
				currentState.pattern = 'daily';
				currentState.selected = 'daily';
			}
			else if (values[5] === '2-6' || values[5] === '2,3,4,5,6') {
				//Expression is daily - weekdays
				currentState.pattern = 'daily';
				currentState.selected = 'weekday';
			}
			else if (values[5].indexOf('#') === -1 && values[5].indexOf('L') === -1 && values[5] !== '?') {
				//Expression is weekly
				currentState.pattern = 'weekly';
				if (values[5].indexOf('-') > 0) {
					inDays = values[5].split('-');
					days = [];
					for (i = parseInt(inDays[0]) ; i <= parseInt(inDays[1]) ; i++) {
						days.push(i);
					};
					currentState.days = days;
				}
				else {
					currentState.days = values[5].split(',');
				}
			}
			else {
				//Expression is monthly
				currentState.pattern = 'monthly';

				if (values[3] === 'L') {
					currentState.selected = 'last';
				}
				else if (values[5].indexOf('#') > 0) {
					var weekdays = values[5].split('#');

					currentState.selected = 'week';
					currentState.dayOfWeek = weekdays[0];
					currentState.occurrence = '#' + weekdays[1];
				}
				else if (values[5].indexOf('L') > 0) {
					var weekday = values[5].split('L')[0];

					currentState.selected = 'week';
					currentState.dayOfWeek = weekday;
					currentState.occurrence = 'L';
				}
				else {
					currentState.selected = 'date';
					if (values[3].indexOf('-') > 0) {
						inDays = values[3].split('-');
						days = [];
						for (i = parseInt(inDays[0]) ; i <= parseInt(inDays[1]) ; i++) {
							days.push(i);
						};
						currentState.days = days;
					}
					else {
						currentState.days = values[3].split(',');
					}

				}
			}

			disableUiUpdates = true;
			updateDom();
			disableUiUpdates = false;
		};

		this.getCron = function (validate) {
			var minute = '*',
			hour = '*',
			dayOfMonth = '*',
			month = '*',
			year = '*',
			dayOfWeek = '?';

			switch (currentState.pattern) {
				case 'daily':
					switch (currentState.selected) {
						case 'daily':
							//Do nothing - use defaults
							break;
						case 'weekday':
							dayOfWeek = '2-6';
							dayOfMonth = '?';
							break;
						default:
							if (validate) {
								throw new CronError(30, currentState.selected);
							}
					}
					break;
				case 'weekly':
					dayOfWeek = currentState.days.join(',');
					if (validate && !dayOfWeek) {
						throw new CronError(40, currentState.pattern);
					}
					dayOfMonth = '?';
					break;
				case 'monthly':
					switch (currentState.selected) {
						case 'date':
							dayOfMonth = currentState.days.join(',');
							break;
						case 'last':
							dayOfMonth = 'L';
							break;
						case 'week':
							dayOfMonth = '?';
							dayOfWeek = currentState.dayOfWeek + currentState.occurrence;
							break;
						default:
							if (validate) {
								throw new CronError(50, currentState.selected);
							}
					}
					break;
				case 'yearly':
					month = currentState.months.join(',');
					switch (currentState.selected) {
						case 'specificDay':
							dayOfMonth = currentState.days.join(',');
							break;
						case 'weekOccurrence':
							dayOfMonth = '?';
							dayOfWeek = currentState.dayOfWeek + currentState.occurrence;
							break;
						default:
							if (validate) {
								throw new CronError(60, currentState.selected, ['']);
							}
					}
					break;
				default:
					if (validate) {
						throw new CronError(13, currentState.pattern);
					}
					break;
			}

			if (currentState.time && currentState.time !== '') {
				var timeArr = currentState.time.split(':');
				hour = parseInt(timeArr[0]) + '';
				minute = parseInt(timeArr[1]) + '';
			} else {
				if (validate) {
					throw new CronError(20);
				}
			}

			var cron = ['0', minute, hour, dayOfMonth, month, dayOfWeek, year]; //Default state = every minute

			cron = cron.map(function (val) {
				//if the value is blank, and validation is disabled
				if (val === '' && !validate) {
					return '*';
				}

				if (validate) {
					validateState();
				}

				return val.toString();
			});

			return cron.join(' ');
		};

		function validateState() {
			//Check for errors in the state of the current model
			if (!currentState.time) {
				throw new CronError(20);
			}

			switch (currentState.pattern) {
				case 'daily':
					switch (currentState.selected) {
						case 'daily':
						case 'weekday':
							//No validation options when these are selected
							break;
						default:
							//No option is selected
							throw new CronError(30, currentState.selected);
					}
					break;
				case 'weekly':
					if (currentState.days.length === 0 || $.inArray('', currentState.days) >= 0) {
						throw new CronError(40, currentState.pattern);
					}
					break;
				case 'monthly':
					switch (currentState.selected) {
						case 'last':
							//No validation when this is selected
							break;
						case 'date':
							if (currentState.days.length === 0 || $.inArray('', currentState.days) >= 0) {
								throw new CronError(51);
							}

							var invalidDays = [];

							$.each(currentState.days, function(index, value){
								if (value > 31){
									invalidDays.push(value);
								}
							});
							if (invalidDays.length > 0) {
								throw new CronError(54, null, [invalidDays.join(', ')]);
							}

							break;
						case 'week':
							if (!currentState.occurrence) {
								throw new CronError(53);
							}

							if (!currentState.dayOfWeek) {
								throw new CronError(52);
							}
							break;
						default:
							throw new CronError(50, currentState.selected);
					}
					break;
				case 'yearly':
					switch (currentState.selected) {
						case 'specificDay':
							if (currentState.months.length === 0 || $.inArray('', currentState.months) >= 0) {
								throw new CronError(62);
							}

							if (currentState.days.length === 0 || $.inArray('', currentState.days) >= 0) {
								throw new CronError(63);
							}

							var invalidDays = [];

							$.each(currentState.days, function(index, value){
								if (value > 31){
									invalidDays.push(value);
								}
							});
							if (invalidDays.length > 0) {
								throw new CronError(66, null, [invalidDays.join(', ')]);
							}

							break;
						case 'weekOccurrence':
							if (!currentState.occurrence) {
								throw new CronError(65);
							}

							if (!currentState.dayOfWeek) {
								throw new CronError(64);
							}

							if (currentState.months.length === 0 || $.inArray('', currentState.months) >= 0) {
								throw new CronError(62);
							}
							break;
						default:
							throw new CronError(61, currentState.selected);
					}
					break;
				default:
					throw new CronError(13, currentState.pattern);
			}

			return true;
		};

		function stringToTimeSpan(val) {
			if (!val) return undefined;

			var AMtoPMthreshold = 8;

			var time = val.trim().match(/^(\d{1,2})(?::)*([0-5][0-9])?\s*((P|A)(?:M)?)?$/i);
			if (time === null) return null;

			var hours = Number(time[1]);
			var minutes = time[2] ? Number(time[2]) : 0;
			var ampm = time[4];

			//Return invalid if military time with AM/PM qualifier.
			if ((hours > 12 && ampm) ||
				hours > 23) return null;

			//consider threshold.
			if (!ampm && hours < 12 && hours > 0 && (hours < AMtoPMthreshold && time[1].length === 1))
				hours = hours + 12;

			//if PM and hours are between 1 and 11.
			if (hours < 12 && hours > 0 && ampm && ampm.toUpperCase() === 'P') hours = hours + 12;
			if (hours === 12 && ampm && ampm.toUpperCase() === 'A') hours = 0;

			var sHours = hours.toString();
			var sMinutes = minutes.toString();
			if (hours < 10) sHours = '0' + sHours;
			if (minutes < 10 && minutes !== '00') sMinutes = '0' + sMinutes;

			return sHours + ':' + sMinutes + ':00';
		}

		function timeSpanToString(val) {
			if (!val) return undefined;

			var time = val.trim().match(/^(\d{2})(?::)(\d{2})(?::)?(\d{2})?$/i);
			if (time === null) return null;

			var hours = Number(time[1]);
			var minutes = Number(time[2]);
			var ampm = 'am';

			if (hours >= 12) {
				ampm = 'pm';
				hours = hours === 12 ? 12 : hours - 12;
			}
			if (hours === 0)
				hours = 12;

			return hours + ':' + (minutes < 10 ? '0' + minutes : minutes) + ' ' + ampm.toUpperCase();
		}

		function evaluate($element) {
			var value = $element.val();

			var military = '';
			if (!value) {
				military = $element.attr('data-time');
			} else {
				military = stringToTimeSpan(value);
			}
			var result = timeSpanToString(military);
			$element.attr('data-time', military).val(result).change();
		}

		function cleanInputs(){
			var dayCleanList = ['[name="date"]', '[name="dayOfMonth"]'];

			$.each(dayCleanList, function(idx, obj){
				var regex = /[^\d\.\-]/g,
					monthlyDays = self.$el.find(obj),
					monthlySplit = monthlyDays.val().split(/[\s,]+/),
					monthlyUnique = monthlySplit.map(function(value){	
							if (!value){
								return value;
							}

							var clean = value.replace(regex, '');

							if (value.indexOf('-') >= 0){
								var pre = clean.substring(0, clean.indexOf('-')),
									post = clean.substring(clean.indexOf('-') + 1, clean.length);

								return Math.floor(pre) + '-' + Math.floor(post);
							}

							return Math.floor(clean).toString();
						}).filter(function(item, index, array){
							return array.length == 0 || (item && index === array.indexOf(item));
						});

				if (monthlyDays.val() && monthlySplit.toString() !== monthlyUnique.toString()){
					monthlyDays.val(monthlyUnique.join()).change();
				}
			});
		}

		function updateDom() {
			self.$el.find('.c-schedule-type input:radio[value="' + currentState.pattern + '"]').prop('checked', true).change();
			self.$el.find('[name="time"]').val(currentState.time);
			self.$el.find('[name="time"]').trigger('blur');

			switch (currentState.pattern) {
				case 'daily':
					self.$el.find('[name="dailyPattern"][value="' + currentState.selected + '"]').prop('checked', true).change();
					break;
				case 'weekly':
					$.each(currentState.days, function () {
						self.$el.find('[name="weeklyDays"] input:checkbox[value="' + this + '"]').prop('checked', true).change();
					});
					break;
				case 'monthly':
					self.$el.find('[name="monthlyPattern"][value="' + currentState.selected + '"]').prop('checked', true).change();
					self.$el.find('[name="date"]').val(currentState.days.join()).change();
					self.$el.find('[name="weekOccurrence"]').val(currentState.occurrence).change();
					self.$el.find('[name="dayOfWeek"]').val(currentState.dayOfWeek).change();
					break;
				case 'yearly':
					self.$el.find('[name="yearPattern"][value="' + currentState.selected + '"]').prop('checked', true).change();
					self.$el.find('[name="monthSpecificDay"]').multipleSelect('setSelects', currentState.months);
					self.$el.find('[name="dayOfMonth"]').val(currentState.days.join()).change();
					self.$el.find('[name="dayOfWeek"]').val(currentState.dayOfWeek).change();
					self.$el.find('[name="weekOccurrence"]').val(currentState.occurrence).change();
					break;
			}
		};

		function updateFromDom() {
			if (disableUiUpdates) {
				return;
			}

			currentState.pattern = self.$el.find('[name="ScheduleType"]:checked').val();
			currentState.time = self.$el.find('[name="time"]').attr('data-time');

			switch (currentState.pattern) {
				case 'daily':
					currentState.selected = self.$el.find('[name="dailyPattern"]:checked').val();
					break;
				case 'weekly':
					currentState.days = self.$el.find('div[name="weeklyDays"] input:checkbox:checked').map(function () { return this.value; }).get();
					break;
				case 'monthly':
					currentState.selected = self.$el.find('[name="monthlyPattern"]:checked').val();
					currentState.occurrence = self.$el.find('[name="weekOccurrence"]').val();
					currentState.dayOfWeek = self.$el.find('[name="dayOfWeek"]').val();
					currentState.days = self.$el.find('[name="date"]').val().split(/[\s,]+/);

					self.$el.find('.js-schedule-monthly [name="weekOccurrence"]').prop('disabled', currentState.selected !== 'week');
					self.$el.find('.js-schedule-monthly [name="dayOfWeek"]').prop('disabled', currentState.selected !== 'week');
					self.$el.find('.js-schedule-monthly [name="date"]').prop('disabled', currentState.selected !== 'date');
					break;
				case 'yearly':
					currentState.selected = self.$el.find('[name="yearPattern"]:checked').val();
					currentState.months = self.$el.find('[name="monthSpecificDay"]').multipleSelect('getSelects');
					currentState.days = self.$el.find('[name="dayOfMonth"]').val().split(/[\s,]+/).sort(function (a, b) { return (parseInt(b) < parseInt(a)) });
					currentState.occurrence = self.$el.find('[name="weekOccurrence"]').val();
					currentState.dayOfWeek = self.$el.find('[name="dayOfWeek"]').val();

					self.$el.find('.js-schedule-yearly [name="monthSpecificDay"]').prop('disabled', currentState.selected !== 'specificDay');
					self.$el.find('.js-schedule-yearly [name="monthSpecificDay"]').multipleSelect(currentState.selected === 'specificDay' ? "enable" : "disable");
					self.$el.find('.js-schedule-yearly [name="dayOfMonth"]').prop('disabled', currentState.selected !== 'specificDay');
					self.$el.find('.js-schedule-yearly [name="weekOccurrence"]').prop('disabled', currentState.selected !== 'weekOccurrence');
					self.$el.find('.js-schedule-yearly [name="dayOfWeek"]').prop('disabled', currentState.selected !== 'weekOccurrence');
					self.$el.find('.js-schedule-yearly [name="monthOccurrence"]').prop('disabled', currentState.selected !== 'weekOccurrence');
					self.$el.find('.js-schedule-yearly [name="monthOccurrence"]').multipleSelect(currentState.selected === 'weekOccurrence' ? "enable" : "disable");
					break;
			}

			if (self.$bindTo && self.$bindTo.val() !== self.getCron()) {
				self.$bindTo.val(self.getCron()).change();
			}
		};

		function hideAll() {
			self.$el.find('.js-schedule-daily').hide();
			self.$el.find('.js-schedule-weekly').hide();
			self.$el.find('.js-schedule-monthly').hide();
			self.$el.find('.js-schedule-yearly').hide();
		};

		function wireEvents() {
			self.$el.find('select[name^="month"]').multipleSelect({
				width: 230,
				multiple: true,
				multipleWidth: 100,
				placeholder: 'Select months',
				selectAll: false,
				minimumCountSelected: 4,
				ellipsis: true,
				allSelected: 'Every month'
			});

			self.$el.find('select[name="monthSpecificDay"]').on('change', function () {
				var thisSelects = $(this).multipleSelect('getSelects');
				var monthOccurrenceSelects = self.$el.find('select[name="monthOccurrence"]').multipleSelect('getSelects');

				//Check to see if they match - otherwise the updates get called recursively forever
				if (!(thisSelects.filter(function (x) { return monthOccurrenceSelects.indexOf(x) < 0 }).length === 0 &&
					monthOccurrenceSelects.filter(function (x) { return thisSelects.indexOf(x) < 0 }).length === 0)) {
					self.$el.find('select[name="monthOccurrence"]').multipleSelect('setSelects', $(this).multipleSelect('getSelects'));
				}
			});

			self.$el.find('select[name="monthOccurrence"]').on('change', function () {
				var thisSelects = $(this).multipleSelect('getSelects');
				var specificDaySelects = self.$el.find('select[name="monthSpecificDay"]').multipleSelect('getSelects');

				//Check to see if they match - otherwise the updates get called recursively forever
				if (!(thisSelects.filter(function (x) { return specificDaySelects.indexOf(x) < 0 }).length === 0 &&
					specificDaySelects.filter(function (x) { return thisSelects.indexOf(x) < 0 }).length === 0)) {
					self.$el.find('select[name="monthSpecificDay"]').multipleSelect('setSelects', $(this).multipleSelect('getSelects'));
				}
			});

			self.$el.find('[name="ScheduleType"]').on('change', function () {
				self.$el.find('.c-schedule-options').show();
				var scr = '.js-schedule-' + $(this).val();
				hideAll();
				self.$el.find(scr).show();
			});

			//synchronize inputs that have the same name across all options
			self.$el.find('[name$="Frequency"]').on('change', function () {
				self.$el.find('[name$="Frequency"]').val($(this).val());
			});

			self.$el.find('[name="weekOccurrence"]').on('change', function () {
				self.$el.find('[name="weekOccurrence"]').val($(this).val());
			});

			self.$el.find('[name="dayOfWeek"]').on('change', function () {
				self.$el.find('[name="dayOfWeek"]').val($(this).val());
			});

			self.$el.find('[name="month"]').on('change', function () {
				self.$el.find('[name="month"]').val($(this).val());
			});

			self.$el.find('input[name="time"]').on('blur', function () {
				evaluate(self.$el.find('input[name="time"]'));
			});
		};

		this.toEnglishString = function () {
			var result = '';

			var toTimeString = function (val) {
				var time = val.trim().match(/^(\d{2})(?::)(\d{2})(?::)?(\d{2})?$/i);
				if (time === null) return null;

				var hours = Number(time[1]);
				var minutes = Number(time[2]);
				var ampm = 'am';

				if (hours >= 12) {
					ampm = 'pm';
					hours = hours === 12 ? 12 : hours - 12;
				}
				if (hours === 0)
					hours = 12;

				return hours + ':' + (minutes < 10 ? '0' + minutes : minutes) + ' ' + ampm.toUpperCase();
			}

			var timeString = toTimeString(currentState.time);

			var toAltValues = function (stringsArr, values) {
				var res;

				if ($.isArray(values)) {
					res = $(values).map(function (i, val) { return stringsArr[parseInt(val) - 1]; });
				} else {
					res = stringsArr[parseInt(values) - 1];
				}

				return $.makeArray(res);
			}

			var toEnglishDays = function (values) {
				var dayList = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

				return toAltValues(dayList, values);
			};

			var toEnglishMonths = function (values) {
				var monthList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

				return toAltValues(monthList, values);
			};

			var toEnglishOccurrence = function (values) {
				var occurrenceList = ['first', 'second', 'third', 'fourth', 'fifth'];

				return toAltValues(occurrenceList, values);
			};

			switch (currentState.pattern) {
				case 'daily':
					result = 'Every ' + (currentState.selected === 'weekday' ? 'week' : '') + 'day at ' + timeString;
					break;
				case 'weekly':
					result = 'Every week on ' + toEnglishDays(currentState.days).join(', ') + ' at ' + timeString;
					break;
				case 'monthly':
					result = 'Every month on the ';
					switch (currentState.selected) {
						case 'date':
							result += currentState.days.join(', ') + ' at ' + timeString;
							break;
						case 'week':
							if (currentState.occurrence !== '') {
								if (currentState.occurrence === 'L') {
									result += 'last';
								} else {
									result += toEnglishOccurrence(currentState.occurrence.split('#')).join('');
								}

								result += ' ' + toEnglishDays(currentState.dayOfWeek).join('') + ' at ' + timeString;
							}
							break;
						case 'last':
							result += 'last day of the month at ' + timeString;
							break;
						default:
							throw new CronError(73, currentState.selected, [currentState.selected]);
					}
					break;
				case 'yearly':
					result = 'Every year on ';
					switch (currentState.selected) {
						case 'specificDay':
							result += toEnglishMonths(currentState.months).join(', ') + ' ' + currentState.days.join(', ') + ' at ' + timeString;
							break;
						case 'weekOccurrence':
							result += 'the '
							if (currentState.occurrence === 'L') {
								result += 'last ';
							} else {
								result += toEnglishOccurrence(currentState.occurrence.split('#')).join('') + ' ';
							}

							result += toEnglishDays(currentState.dayOfWeek).join('') + ' of ' + toEnglishMonths(currentState.months).join(', ') + ' at ' + timeString;
							break;
						default:
							throw new CronError(74, currentState.selected, [currentState.selected]);
					}

					break;
				default:
					throw new CronError(70, currentState.pattern, [currentState.pattern]);
			}

			return result;
		};

		try {
			init();
		}
		catch (e) {
			throw new CronError(80, e, [e.message]);
		}
	}
	this.jsCronUI = jsCronUI;
}).call(this, jQuery);
