# Example of an Overly Detailed Sequence Diagram

This diagram was generated from a simple `TodoItemController.createTodoItem` endpoint and illustrates the level of detail that can obscure the high-level architectural flow. This is the kind of output the "Simplifying Generated Sequence Diagrams" task aims to improve.

```mermaid
sequenceDiagram
    participant TodoItemController_createTodoItem_TodoItem____ResponseEntity<TodoItem>
    participant ResponseEntity_ok_T__<T>___ResponseEntity<T>
    TodoItemController_createTodoItem_TodoItem____ResponseEntity<TodoItem>->>ResponseEntity_ok_T__<T>___ResponseEntity<T>: ok(T) <T> : ResponseEntity<T>()
    participant ResponseEntity_ok_____BodyBuilder
    ResponseEntity_ok_T__<T>___ResponseEntity<T>->>ResponseEntity_ok_____BodyBuilder: ok() : BodyBuilder()
    participant ResponseEntity_status_HttpStatusCode____BodyBuilder
    ResponseEntity_ok_____BodyBuilder->>ResponseEntity_status_HttpStatusCode____BodyBuilder: status(HttpStatusCode) : BodyBuilder()
    participant Assert_notNull_Object,_String____void
    ResponseEntity_status_HttpStatusCode____BodyBuilder->>Assert_notNull_Object,_String____void: notNull(Object, String) : void()
    participant ResponseEntity$DefaultBuilder_DefaultBuilder_HttpStatusCode
    ResponseEntity_status_HttpStatusCode____BodyBuilder->>ResponseEntity$DefaultBuilder_DefaultBuilder_HttpStatusCode: DefaultBuilder(HttpStatusCode)()
    participant ResponseEntity$BodyBuilder_body_T__<T>___ResponseEntity<T>
    ResponseEntity_ok_T__<T>___ResponseEntity<T>->>ResponseEntity$BodyBuilder_body_T__<T>___ResponseEntity<T>: body(T) <T> : ResponseEntity<T>()
    participant ResponseEntity$DefaultBuilder_contentLength_long____BodyBuilder
    ResponseEntity$BodyBuilder_body_T__<T>___ResponseEntity<T>->>ResponseEntity$DefaultBuilder_contentLength_long____BodyBuilder: contentLength(long) : BodyBuilder()
    participant HttpHeaders_setContentLength_long____void
    ResponseEntity$DefaultBuilder_contentLength_long____BodyBuilder->>HttpHeaders_setContentLength_long____void: setContentLength(long) : void()
    participant HttpHeaders_set_String,_String____void
    HttpHeaders_setContentLength_long____void->>HttpHeaders_set_String,_String____void: set(String, String) : void()
    participant Long_toString_long____String
    HttpHeaders_setContentLength_long____void->>Long_toString_long____String: toString(long) : String()
    participant ResponseEntity$DefaultBuilder_contentType_MediaType____BodyBuilder
    ResponseEntity$BodyBuilder_body_T__<T>___ResponseEntity<T>->>ResponseEntity$DefaultBuilder_contentType_MediaType____BodyBuilder: contentType(MediaType) : BodyBuilder()
    participant HttpHeaders_setContentType_MediaType____void
    ResponseEntity$DefaultBuilder_contentType_MediaType____BodyBuilder->>HttpHeaders_setContentType_MediaType____void: setContentType(MediaType) : void()
    participant Assert_isTrue_boolean,_String____void
    HttpHeaders_setContentType_MediaType____void->>Assert_isTrue_boolean,_String____void: isTrue(boolean, String) : void()
    HttpHeaders_setContentType_MediaType____void->>Assert_isTrue_boolean,_String____void: isTrue(boolean, String) : void()
    participant MimeType_isWildcardType_____boolean
    HttpHeaders_setContentType_MediaType____void->>MimeType_isWildcardType_____boolean: isWildcardType() : boolean()
    participant MimeType_isWildcardSubtype_____boolean
    HttpHeaders_setContentType_MediaType____void->>MimeType_isWildcardSubtype_____boolean: isWildcardSubtype() : boolean()
    HttpHeaders_setContentType_MediaType____void->>HttpHeaders_set_String,_String____void: set(String, String) : void()
    participant MimeType_toString_____String
    HttpHeaders_setContentType_MediaType____void->>MimeType_toString_____String: toString() : String()
    participant HttpHeaders_remove_Object____List<String>
    HttpHeaders_setContentType_MediaType____void->>HttpHeaders_remove_Object____List<String>: remove(Object) : List<String>()
    participant ResponseEntity$DefaultBuilder_body_T__<T>___ResponseEntity<T>
    ResponseEntity$BodyBuilder_body_T__<T>___ResponseEntity<T>->>ResponseEntity$DefaultBuilder_body_T__<T>___ResponseEntity<T>: body(T) <T> : ResponseEntity<T>()
    participant ResponseEntity_ResponseEntity_T,_MultiValueMap<String,_String>,_HttpStatusCode
    ResponseEntity$DefaultBuilder_body_T__<T>___ResponseEntity<T>->>ResponseEntity_ResponseEntity_T,_MultiValueMap<String,_String>,_HttpStatusCode: ResponseEntity(T, MultiValueMap<String, String>, HttpStatusCode)()
    participant HttpEntity_HttpEntity_T,_MultiValueMap<String,_String>
    ResponseEntity_ResponseEntity_T,_MultiValueMap<String,_String>,_HttpStatusCode->>HttpEntity_HttpEntity_T,_MultiValueMap<String,_String>: HttpEntity(T, MultiValueMap<String, String>)()
    ResponseEntity_ResponseEntity_T,_MultiValueMap<String,_String>,_HttpStatusCode->>Assert_notNull_Object,_String____void: notNull(Object, String) : void()
    participant TodoItemService_save_TodoItem____TodoItem
    TodoItemController_createTodoItem_TodoItem____ResponseEntity<TodoItem>->>TodoItemService_save_TodoItem____TodoItem: save(TodoItem) : TodoItem()
    participant CrudRepository_save_S__<S_extends_T>___S
    TodoItemService_save_TodoItem____TodoItem->>CrudRepository_save_S__<S_extends_T>___S: save(S) <S extends T> : S()
```