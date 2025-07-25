package lila.oauth

import reactivemongo.api.bson.*
import com.roundeights.hasher.Algo

import lila.core.net.Bearer
import lila.core.misc.oauth.AccessTokenId

case class AccessToken(
    id: AccessTokenId,
    plain: Bearer,
    userId: UserId,
    createdAt: Option[Instant],
    description: Option[String], // for personal access tokens
    usedAt: Option[Instant] = None,
    scopes: TokenScopes,
    clientOrigin: Option[String],
    expires: Option[Instant]
):
  def isBrandNew = createdAt.exists(nowInstant.minusSeconds(5).isBefore)

  def isDangerous = scopes.intersects(OAuthScope.dangerList)

object AccessToken:

  case class ForAuth(
      userId: UserId,
      scopes: TokenScopes,
      tokenId: AccessTokenId,
      clientOrigin: Option[String]
  )

  object BSONFields:
    val id = "_id"
    val plain = "plain"
    val userId = "userId"
    val createdAt = "created"
    val description = "description"
    val usedAt = "used"
    val scopes = "scopes"
    val clientOrigin = "clientOrigin"
    val expires = "expires"

  def idFrom(bearer: Bearer) = AccessTokenId(Algo.sha256(bearer.value).hex)

  import lila.db.BSON
  import lila.db.dsl.{ *, given }
  import OAuthScope.given

  private[oauth] val forAuthProjection = $doc(
    BSONFields.userId -> true,
    BSONFields.scopes -> true,
    BSONFields.clientOrigin -> true
  )

  given BSONDocumentReader[ForAuth] = new:
    def readDocument(doc: BSONDocument) = for
      tokenId <- doc.getAsTry[AccessTokenId](BSONFields.id)
      userId <- doc.getAsTry[UserId](BSONFields.userId)
      scopes <- doc.getAsTry[TokenScopes](BSONFields.scopes)
      origin = doc.getAsOpt[String](BSONFields.clientOrigin)
    yield ForAuth(userId, scopes, tokenId, origin)

  given BSONDocumentHandler[AccessToken] = new BSON[AccessToken]:

    import BSONFields.*

    def reads(r: BSON.Reader): AccessToken =
      AccessToken(
        id = r.get[AccessTokenId](id),
        plain = r.get[Bearer](plain),
        userId = r.get[UserId](userId),
        createdAt = r.getO[Instant](createdAt),
        description = r.strO(description),
        usedAt = r.getO[Instant](usedAt),
        scopes = r.get[TokenScopes](scopes),
        clientOrigin = r.strO(clientOrigin),
        expires = r.getO[Instant](expires)
      )

    def writes(w: BSON.Writer, o: AccessToken) =
      $doc(
        id -> o.id,
        plain -> o.plain,
        userId -> o.userId,
        createdAt -> o.createdAt,
        description -> o.description,
        usedAt -> o.usedAt,
        scopes -> o.scopes,
        clientOrigin -> o.clientOrigin,
        expires -> o.expires
      )
