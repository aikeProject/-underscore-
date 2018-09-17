// 学习underscore
(function () {
    /*
        self 存在是浏览器端
        global node端
    */
    var root = typeof self == 'object' && typeof self.self == 'object' && self ||
        typeof global == 'object' && typeof global.global == 'object' && global ||
        this || {};

    var previousUnderscore = root;

    var ArrayProto = Array.prototype,
        ObjProto = Object.prototype;
    var SymbolProto = typeof Symbol == 'undefined' ? Symbol.prototype : null;

    var push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    var nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeCreate = Object.create; // 使用现有对象来提供创建对象的__proto__

    var Ctor = function () {
    };

    // 把对象转化为 _ 对象
    var _ = function (obj) {
        // 如果本身就是 _ 直接返回
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
    };

    // 检测环境，分别将 _ 挂到浏览器 node的全局对象上
    if (typeof exports != 'undefined' && !exports.nodeType) {
        if (typeof module != 'undefined' && !module.nodeType && module.exports) {
            // 导出的方式
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        // 挂到全局对象上
        root._ = _;
    }

    _.VERSION = '成雨';

    // 优化回调
    // 如果没有指定context直接返回原函数
    var optimizeCb = function (func, context, argGount) {
        // void 0 -> undefined
        if (context === void 0) return func;
        switch (argGount) {
            case 1:
                return function (value) {
                    return func.call(context, value);
                };
            case null:
                ;
            case 3:
                return function (value, index, collection) {
                    return func.call(context, value, index, collection);
                };
            case 4:
                return function (accumulator, value, index, collection) {
                    return func.call(context, accumulator, value, index, collection);
                }
        }
        return function () {
            return func.apply(context, arguments);
        }
    };

    var builtinIteratee;

    // 根据传入value的类型，分别调用不同的方法并返回结果
    var cb = function (value, context, argCount) {
        if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
        // null 原样返回 _.identity 如果第二个参数为空或undefined 给它一个函数
        if (value == null) return _.identity;
        // 如果是函数
        if (_.isFunction(value)) return optimizeCb(value, context, argCount);
        // 如果是对象
        if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
        return _.property(value);
    };

    _.iteratee = builtinIteratee = function (value, context) {
        return cb(value, context, Infinity);
    };

    var restArgs = function (func, startIndex) {
        startIndex = startIndex == null ? func.length - 1 : +startIndex;
        return function () {
            var length = Math.max(arguments.length - startIndex, 0),
                rest = Array(length),
                index = 0;
            for (; index < length; index++) {
                rest[index] = arguments[index + startIndex];
            }
            switch (startIndex) {
                case 0:
                    return func.call(this, rest);
                case 1:
                    ;
                    return func.call(this, arguments[0], rest);
                case 2:
                    return func.call(this, arguments[0], arguments[1], rest);
            }
            var args = Array(startIndex + 1);
            for (index = 0; index < startIndex; index++) {
                args[index] = arguments[index];
            }
            args[startIndex] = rest;
            return func.apply(this, args);
        }
    };
	
	var deepGet = function(obj, path) {
		var length = path.length;
		for (var i = 0; i < length; i++) {
			if (obj == null) return void 0;
			obj = obj[path[i]];
		}
		return length ? obj : void 0;
	};


    // 创建对象
    var baseCreate = function (prototype) {
        if (!_.isObject(prototype)) return {};
        if (nativeCreate) return nativeCreate(prototype);

        Ctor.prototype = prototype;
        var result = new Ctor;
        Ctor.prototype = null;
        return result;
    };

    // 传入属性，找到对象值
    var shallowProperty = function (key) {
        return function (obj) {
            return obj == null ? void 0 : obj[key];
        }
    };

    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

    var getLength = shallowProperty('length');
    // 检查是不是类数组
    var isArrayLike = function (collection) {
        var length = getLength(collection);
        return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
    };

    // each
    _.each = _.forEach = function (obj, iteratee, context) {
        // 这里调用了前面定义的方法，返回的是传入函数本身
        iteratee = optimizeCb(iteratee, context);
        var i, length;
        // 如果是数组或者伪数组，直接遍历即可
        if (isArrayLike(obj)) {
            for (i = 0, length = obj.length; i < length; i++) {
                iteratee(obj[i], i, obj);
            }
        } else {
            var keys = _.keys(obj);
            for (i = 0, length = keys.length; i < length; i++) {
                iteratee(obj[keys[i]], keys[i], obj);
            }
        }
        return obj;
    };

    // map
    _.map = _.collect = function (obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        // 如果传入的是对象，取出所有的key
        var keys = !isArrayLike(obj) && _.keys(obj),
            length = (keys || obj).length,
            result = Array(length);
        for (var index = 0; index < length; index++) {
            // 如果keys存在，也就是说是对象，就用key来找对应的内容。否则就按数组的形式来即可
            var currentKey = keys ? keys[index] : index;
            result[index] = iteratee(obj[currentKey], currentKey, obj);
        }
        return result;
    };

    // 工厂函数
    /**
     * dir 大于 0 index 从0开始，即从左往右进行
     * dir 小于 0 index 从length - 1 开始 即可以从右往左进行
     * @param dir
     * @returns {Function}
     */
    var createReduce = function (dir) {
        var reducer = function (obj, iteratee, memo, initial) {
            var keys = !isArrayLike(obj) && _.keys(obj),
                length = (keys || obj).length,
                index = dir > 0 ? 0 : length - 1;
            if (!initial) {
                // 只有三个参数的话
                memo = obj[keys ? keys[index] : index];
                index += dir;
            }
            // memo是每一次循环之后的返回值，它有被用来作为回调的第一个参数
            for (; index >= 0 && index < length; index += dir) {
                var currentKey = keys ? keys[index] : index;
                memo = iteratee(memo, obj[currentKey], currentKey, obj);
            }
            return memo;
        }
        return function (obj, iteratee, memo, context) {
            var initial = arguments.length >= 3;
            return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
        }
    };

    // 从左往右
    _.reduce = _.foldl = _.inject = createReduce(1);

    // 从右往左
    _.reduceRight = _.foldr = createReduce(-1);

    // var even = _.find([1, 2, 3, 4, 5, 6], function(num){ return num % 2 == 0; });
    _.find = _.detect = function (obj, predicate, context) {
        // 传入参数不同分别调用对应数组和对应对象的方法来查找为true的索引值
        var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
        // 执行函数返回索引
        var key = keyFinder(obj, predicate, context);
        // 索引存在返回索引对应的值
        if (key !== void 0 && key !== -1) return obj[key];
    }

    // 找到数组或对象中所有符合你条件的值，放入数组，返回给你
    _.filter = _.select = function (obj, predicate, context) {
        var results = [];
        predicate = cb(predicate, context);
        _.each(obj, function (value, index, list) {
            if (predicate(value, index, list)) results.push(value);
        });
        return results;
    }

    _.where = function (obj, attrs) {
        // matcher 返回一个断言函数，可以判断属性和值是否匹配
        // 我传入的条件是一个对象，即attrs。
        // 返回的函数只需再传入，你的目标对象进行判断即可
        return _.filter(obj, _.matcher(attrs));
    }

    _.findWhere = function (obj, attrs) {
        return _.find(obj, _.matcher(attrs));
    }

    _.reject = function (obj, predicate, context) {
        // 最终执行的为 !predicate 即与给定条件相反的值
        return _.filter(obj, _.negate(cb(predicate), context));
    }

    _.every = _.all = function (obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = !isArrayLike(obj) && _.keys(oj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (!predicate(obj[currentKey], currentKey, obj)) return false;
        }
        return true;
    }

    // 只要有符合条件的就返回true
    _.some = _.any = function (obj, predicate, context) {
        predicate = cb(predicate, context);
        console.log(predicate);
        var keys = !isArrayLike(obj) && _.keys(oj),
            length = (keys || obj).length;
        for (var index = 0; index < length; index++) {
            var currentKey = keys ? keys[index] : index;
            if (predicate(obj[currentKey], currentKey, obj)) return true;
        }
        return true;
    }

    // _.contains(list, value, [fromIndex]) 
    // 如果list包含指定的value则返回true（愚人码头注：使用===检测）。如果list 是数组，内部使用indexOf判断。使用fromIndex来给定开始检索的索引位置。
    _.contains = _.includes = _.include = function (obj, item, fromIndex, guard) {
        // 不是数组，取出对象的所有value
        if (!isArrayLike(obj)) obj = _.values(obj);
        if (typeof fromIndex != 'number' || guard) fromIndex = 0;
        // 在所value中寻找符合给定value
        return _.indexOf(obj, item, fromIndex) >= 0;
    };
	
	// 传入指定的方法名，让obj里面的内容执行该方法
	// 
    _.invoke = restArgs(function (obj, path, args) {
        var contextPath, func;
        if (_.isFunction(path)) {
            func = path;
        } else if (_.isArray(path)) {
            contextPath = path.slice(0, -1);
            path = path[path.length - 1];
        }
        return _.map(obj, function (context) {
            var method = func;
            if (!method) {
                if (contextPath && contextPath.length) {
                    context = deepGet(context, contextPath);
                }
                if (context == null) {
                    return void 0;
                }
                method = context[path];
            }
            return method == null ? method : method.apply(context, args)
        });
    });

    // 从指定数组中找内容，返回位置
    var createPredicateIndexFinder = function (dir) {
        return function (array, predicate, context) {
            // predicate 如果为函数，返回函数
            predicate = cb(predicate, context);
            var length = getLength(array);
            var index = dir > 0 ? 0 : length - 1;
            // idr > 0 从零开始遍历
            for (; index >= 0 && index < length; index += dir) {
                // 1. 回调函数返回，值、索引、当前数组
                // 2. 如果回调判断条件为true，返回对应值的索引
                if (predicate(array[index], index, array)) return index;
            }
            // 没有找到返回 -1
            return -1;
        }
    };

    // 从0开始查找

    _.findIndex = createPredicateIndexFinder(1);

    _.sortedIndex = function (array, obj, iteratee, context) {
        iteratee = cb(iteratee, context);
        var value = iteratee(obj);
        var low = 0,
            high = getLength(array);
        while (low < high) {
            var mid = Math.floor((low + high) / 2);
            if (iteratee(array[mid]) < value) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    };

    var createIndexFinder = function (dir, predicateFind, sortedIndex) {
        return function (array, item, idx) {
            var i = 0, length = getLength(array);
            if (typeof idx == 'number') {
                if (dir > 0) {
                    i = idx >= 0 ? idx : Math.max(idx + length, 1);
                } else {
                    length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
                }
            } else if (sortedIndex && idx && length) {
                idx = sortedIndex(array, item);
                return array[idx] === item ? idx : -1;
            }
            if (item !== item) {
                idx = predicateFind(slice.call(array, i, length), _.isNaN);
                return idx >= 0 ? idx + 1 : -1;
            }
            for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
                if (array[idx] === item) return idx;
            }
            return -1;
        };
    };

    // _.findIndex 返回数组索引值
    _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

    _.negate = function (predicate) {
        return function () {
            return !predicate.apply(this, arguments);
        }
    }

    // 原样返回
    _.identity = function (value) {
        return value;
    };

    _.property = function (path) {
        // 如果不是数组
        if (!_.isArray(path)) {
            return shallowProperty(path);
        }
        return function (obj) {
            return deepGet(obj, path);
        }
    };

    // 检查是否是一个函数
    var nodelist = root.document && root.document.childNodes;
    if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
        _.isFunction = function (obj) {
            return typeof obj == 'function' || false;
        };
    }

    // 检查是不是一个对象
    // 非纯粹对象 函数和{}都会返回true
    _.isObject = function (obj) {
        var type = typeof obj;
        // type === 'object' && !!obj 是对象，并且不为空
        return type === 'function' || type === 'object' && !!obj;
    };

    // 检测是不是一个数组
    // toString.call(obj) 调用Object.prototype 上的toString方法
    _.isArray = function (obj) {
        return toString.call(obj) === '[object Array]';
    };

    _.isNaN = function (obj) {
        return _.isNumber(obj) && isNaN(obj);
    };

    /**
     * 返回一个断言函数，这个函数会给你一个断言可以用来辨别给定的对象是否匹配attrs指定键/值属性。
     var ready = _.matcher({selected: true, visible: true});
     var readyToGoList = _.filter(list, ready);
     * @type {matches}
     */
    _.matcher = _.matches = function (attrs) {
        // 浅拷贝一下
        attrs = _.extendOwn({}, attrs);
        return function (obj) {
            return _.isMatch(obj, attrs);
        }
    };

    // 取出对象所有的key
    _.keys = function (obj) {
        // 检查是不是对象
        if (!_.isObject(obj)) return [];
        var keys = [];
        // 只取出对象实例上的key _.has 就是判断对象实例上的key
        for (var key in obj)
            if (_.has(obj, key)) keys.push(key);
        // 这里是解决ie的bug的，将低版本ie不能返回的key加入到keys中
        if (hasEnumBug) collectNonEnumProps(obj, keys);
        return keys;
    };

    // 实现一个 Object.assign() 方法
    var createAssigner = function (keysFunc, defaults) {
        // 传入了获取keys的方法
        return function (obj) {
            var length = arguments.length;
            if (defaults) obj = Object(obj);
            // 如果传参小于两个或者参数为空，直接返回传入的参数
            if (length < 2 || obj == null) return obj;
            for (var index = 1; index < length; index++) {
                var source = arguments[index],
                    keys = keysFunc(source), // 拿到参数的所有key
                    l = keys.length;
                for (var i = 0; i < l; i++) {
                    var key = keys[i];
                    if (!defaults || obj[key] === void 0) obj[key] = source[key];
                }
            }
            return obj;
        }
    };

    /**
     * 复制自己的属性覆盖到目标对象
     * _.assign({name: 'moe'}, {age: 50});
     => {name: 'moe', age: 50}
     */
    _.extendOwn = _.assign = createAssigner(_.keys);

    // 查找符合条件对象的key值
    _.findKey = function (obj, predicate, context) {
        predicate = cb(predicate, context);
        var keys = _.keys(obj), key;
        for (var i = 0, length = keys.length; i < length; i++) {
            key = keys[i];
            if (predicate(obj[key], key, obj)) return key;
        }
    }

    // propertyIsEnumerable 判断指定属性是否为对象实例的一部分，以及是否可枚举
    // 解决IE枚举对象的bug
    // 1.判断toString 是否可枚举是否是用户自定义的
    var hasEnumBug = !{
        toString: null
    }.propertyIsEnumerable('toString');
    // 2.解决这个bug
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
        'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
    var collectNonEnumProps = function (obj, keys) {
        var nonEnumIdx = nonEnumerableProps.length;
        var constructor = obj.constructor;
        var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

        var prop = 'constructor';
        // 判断实例是否在对象实例上,并且keys中没有constructor
        if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    };

    // 判断对象中是否有指定的key
    _.has = function (obj, path) {
        // 对象key不是数组
        if (!_.isArray(path)) {
            return obj != null && hasOwnProperty.call(obj, path);
        }
        // path 如果传入一个数组
        var length = path.length;
        for (var i = 0; i < length; i++) {
            var key = path[i];
            if (obj == null || !hasOwnProperty.call(obj, path)) {
                return false;
            }
            obj = obj[key];
        }
        return !!length;
    };

    // 取出对象里的value值
    _.values = function (obj) {
        var keys = _.keys(obj);
        var length = keys.length;
        var values = Array(length);
        for (var i = 0; i < length; i++) {
            values[i] = obj[keys[i]];
        }
        return values;
    };
    /**
     * attrs中的建是否包含在object中
     * var stooge = {name: 'moe', age: 32};
     _.isMatch(stooge, {age: 32});
     => true
     * @param object Object
     * @param attrs Object
     * @returns {boolean}
     */
    _.isMatch = function (object, attrs) {
        var keys = _.keys(attrs), length = keys.length;
        if (object == null) return !length;
        var obj = Object(object);
        // attrs中的键值是否都存在于object中
        for (var i = 0; i < length; i++) {
            var key = keys[i];
            if (attrs[key] !== obj[key] || !(key in obj)) return false;
        }
        return true;
    }
}());
