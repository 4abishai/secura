package com.secura.repository;

import com.secura.entity.Message;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface MessageRepository extends R2dbcRepository<Message, Long> {

    Flux<Message> findByRecipient(String recipient);

    @Query("SELECT * FROM messages WHERE sender = :user OR recipient = :user ORDER BY timestamp ASC")
    Flux<Message> findAllMessagesForUser(@Param("user") String user);

    Flux<Message> findByRecipientAndDeliveredFalse(String recipient);

    Mono<Void> deleteById(Long id);
}