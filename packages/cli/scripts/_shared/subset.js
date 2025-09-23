export function isSubset(expected, actual) {
    if (expected === actual)
        return true;
    // Primitive branch
    const expPrim = expected === null || typeof expected !== 'object';
    const actPrim = actual === null || typeof actual !== 'object';
    if (expPrim || actPrim)
        return expected === actual;
    // Arrays
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual))
            return false;
        if (expected.length > actual.length)
            return false;
        for (let i = 0; i < expected.length; i++) {
            if (!isSubset(expected[i], actual[i]))
                return false;
        }
        return true;
    }
    // Objects
    const eObj = expected;
    const aObj = actual;
    for (const key of Object.keys(eObj)) {
        if (!(key in aObj))
            return false;
        if (!isSubset(eObj[key], aObj[key]))
            return false;
    }
    return true;
}
//# sourceMappingURL=subset.js.map