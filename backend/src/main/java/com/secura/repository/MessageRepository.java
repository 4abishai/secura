package com.secura.repository;

import com.secura.entity.Message;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface MessageRepository extends ReactiveMongoRepository<Message, String> {

    Flux<Message> findByRecipient(String recipient);

    @Query("{ '$or': [ { 'sender': ?0 }, { 'recipient': ?0 } ] }")
    Flux<Message> findAllMessagesForUser(String user);

    Flux<Message> findByRecipientAndDeliveredFalse(String recipient);
}
