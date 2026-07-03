package com.fina.android.data.api

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(context: Context) : CookieJar {
    private val prefs = context.getSharedPreferences("fina_session", Context.MODE_PRIVATE)
    private val cookies = mutableMapOf<String, Cookie>()

    init {
        prefs.all.forEach { (_, value) ->
            (value as? String)?.let(::decode)?.takeIf { it.expiresAt > System.currentTimeMillis() }?.let { cookies[it.name] = it }
        }
    }

    override fun saveFromResponse(url: HttpUrl, newCookies: List<Cookie>) {
        newCookies.forEach { cookie ->
            if (cookie.expiresAt <= System.currentTimeMillis()) {
                cookies.remove(cookie.name); prefs.edit().remove(cookie.name).apply()
            } else {
                cookies[cookie.name] = cookie; prefs.edit().putString(cookie.name, encode(cookie)).apply()
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        val expired = cookies.values.filter { it.expiresAt <= now }.map { it.name }
        expired.forEach { cookies.remove(it); prefs.edit().remove(it).apply() }
        return cookies.values.filter { it.matches(url) }
    }

    fun clear() { cookies.clear(); prefs.edit().clear().apply() }

    private fun encode(c: Cookie) = listOf(c.name, c.value, c.domain, c.path, c.expiresAt.toString(), c.secure.toString(), c.hostOnly.toString()).joinToString("\u001f")
    private fun decode(raw: String): Cookie? = runCatching {
        val p = raw.split("\u001f")
        Cookie.Builder().name(p[0]).value(p[1]).apply { if (p[6].toBoolean()) hostOnlyDomain(p[2]) else domain(p[2]) }
            .path(p[3]).expiresAt(p[4].toLong()).apply { if (p[5].toBoolean()) secure() }.httpOnly().build()
    }.getOrNull()
}
